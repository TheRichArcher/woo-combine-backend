from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any
from pydantic import BaseModel
from ..auth import get_current_user, require_role
import logging
from ..firestore_client import db
from datetime import datetime
from ..models import EvaluatorSchema, DrillResultSchema, MultiEvaluatorDrillResult
from ..utils.database import execute_with_timeout
import statistics

router = APIRouter()

class AddEvaluatorRequest(BaseModel):
    name: str
    email: str
    role: str  # 'head_coach', 'assistant_coach', 'evaluator', 'scout'

class DrillEvaluationRequest(BaseModel):
    player_id: str
    drill_type: str
    value: float
    notes: str = ""

@router.get('/events/{event_id}/evaluators', response_model=List[EvaluatorSchema])
def get_event_evaluators(
    event_id: str,
    current_user=Depends(get_current_user)
):
    """Get all evaluators for an event"""
    try:
        evaluators_ref = db.collection("events").document(event_id).collection("evaluators")
        evaluators = execute_with_timeout(
            lambda: list(evaluators_ref.where("active", "==", True).stream()),
            timeout=10,
            operation_name="get event evaluators"
        )
        
        result = []
        for doc in evaluators:
            evaluator_data = doc.to_dict()
            evaluator_data['id'] = doc.id
            result.append(EvaluatorSchema(**evaluator_data))
        
        logging.info(f"Retrieved {len(result)} evaluators for event {event_id}")
        return result
        
    except Exception as e:
        logging.error(f"Error getting evaluators for event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get evaluators")

@router.post('/events/{event_id}/evaluators')
def add_evaluator(
    event_id: str,
    request: AddEvaluatorRequest,
    current_user=Depends(require_role("organizer", "coach"))
):
    """Add an evaluator to an event (requires organizer/coach role)"""
    try:
        # Proper role checking is now enforced by the require_role decorator
        # Only organizers and coaches can add evaluators
        
        evaluator_data = {
            "name": request.name,
            "email": request.email, 
            "role": request.role,
            "event_id": event_id,
            "added_by": current_user["uid"],
            "added_at": datetime.utcnow().isoformat(),
            "active": True
        }
        
        # Add to event's evaluators subcollection
        evaluators_ref = db.collection("events").document(event_id).collection("evaluators")
        doc_ref = evaluators_ref.document()
        
        execute_with_timeout(
            lambda: doc_ref.set(evaluator_data),
            timeout=10,
            operation_name="add evaluator"
        )
        
        logging.info(f"Added evaluator {request.name} to event {event_id}")
        return {"evaluator_id": doc_ref.id}
        
    except Exception as e:
        logging.error(f"Error adding evaluator to event {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add evaluator")

@router.post('/events/{event_id}/evaluations')
def submit_drill_evaluation(
    event_id: str,
    evaluation: DrillEvaluationRequest,
    current_user=Depends(require_role("organizer", "coach"))
):
    """Submit a drill evaluation from an evaluator"""
    try:
        # Create individual drill result with evaluator info
        drill_result = {
            "player_id": evaluation.player_id,
            "type": evaluation.drill_type,
            "value": evaluation.value,
            "evaluator_id": current_user["uid"],
            "evaluator_name": current_user.get("name") or current_user.get("email"),
            "notes": evaluation.notes,
            "created_at": datetime.utcnow().isoformat(),
            "event_id": event_id
        }
        
        # Store individual evaluation
        evaluations_ref = db.collection("events").document(event_id).collection("drill_evaluations")
        doc_ref = evaluations_ref.document()
        
        execute_with_timeout(
            lambda: doc_ref.set(drill_result),
            timeout=10,
            operation_name="submit drill evaluation"
        )
        
        # Update aggregated results
        _update_aggregated_drill_results(event_id, evaluation.player_id, evaluation.drill_type)
        
        logging.info(f"Submitted evaluation for player {evaluation.player_id}, drill {evaluation.drill_type}")
        return {"evaluation_id": doc_ref.id}
        
    except Exception as e:
        logging.error(f"Error submitting drill evaluation: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit evaluation")

@router.get('/events/{event_id}/players/{player_id}/evaluations')
def get_player_evaluations(
    event_id: str,
    player_id: str,
    current_user=Depends(get_current_user)
):
    """Get all evaluations for a specific player"""
    try:
        evaluations_ref = db.collection("events").document(event_id).collection("drill_evaluations")
        evaluations = execute_with_timeout(
            lambda: list(evaluations_ref.where("player_id", "==", player_id).stream()),
            timeout=10,
            operation_name="get player evaluations"
        )
        
        result = {}
        for doc in evaluations:
            eval_data = doc.to_dict()
            drill_type = eval_data['type']
            
            if drill_type not in result:
                result[drill_type] = []
            
            result[drill_type].append({
                'id': doc.id,
                'value': eval_data['value'],
                'evaluator_name': eval_data.get('evaluator_name', 'Unknown'),
                'evaluator_id': eval_data.get('evaluator_id'),
                'notes': eval_data.get('notes', ''),
                'created_at': eval_data['created_at']
            })
        
        logging.info(f"Retrieved evaluations for player {player_id}")
        return result
        
    except Exception as e:
        logging.error(f"Error getting player evaluations: {e}")
        raise HTTPException(status_code=500, detail="Failed to get player evaluations")

@router.get('/events/{event_id}/aggregated-results')
def get_aggregated_results(
    event_id: str,
    current_user=Depends(get_current_user)
):
    """Get aggregated drill results for all players in an event"""
    try:
        aggregated_ref = db.collection("events").document(event_id).collection("aggregated_drill_results")
        results = execute_with_timeout(
            lambda: list(aggregated_ref.stream()),
            timeout=15,
            operation_name="get aggregated results"
        )
        
        aggregated_data = {}
        for doc in results:
            result_data = doc.to_dict()
            player_id = result_data['player_id']
            drill_type = result_data['drill_type']
            
            if player_id not in aggregated_data:
                aggregated_data[player_id] = {}
            
            aggregated_data[player_id][drill_type] = {
                'final_score': result_data['final_score'],
                'average_score': result_data['average_score'],
                'median_score': result_data['median_score'],
                'score_count': result_data['score_count'],
                'score_variance': result_data.get('score_variance'),
                'evaluations': result_data['evaluations'],
                'updated_at': result_data['updated_at']
            }
        
        logging.info(f"Retrieved aggregated results for event {event_id}")
        return aggregated_data
        
    except Exception as e:
        logging.error(f"Error getting aggregated results: {e}")
        raise HTTPException(status_code=500, detail="Failed to get aggregated results")

def _update_aggregated_drill_results(event_id: str, player_id: str, drill_type: str):
    """Update aggregated drill results when a new evaluation is submitted"""
    try:
        # Get all evaluations for this player and drill type
        evaluations_ref = db.collection("events").document(event_id).collection("drill_evaluations")
        evaluations = execute_with_timeout(
            lambda: list(evaluations_ref
                        .where("player_id", "==", player_id)
                        .where("type", "==", drill_type)
                        .stream()),
            timeout=10,
            operation_name="get evaluations for aggregation"
        )
        
        if not evaluations:
            return
        
        # Extract scores and calculate statistics
        scores = []
        evaluation_details = []
        
        for doc in evaluations:
            eval_data = doc.to_dict()
            scores.append(eval_data['value'])
            evaluation_details.append({
                'evaluator_id': eval_data.get('evaluator_id'),
                'evaluator_name': eval_data.get('evaluator_name', 'Unknown'),
                'value': eval_data['value'],
                'notes': eval_data.get('notes', ''),
                'created_at': eval_data['created_at']
            })
        
        if len(scores) == 0:
            return
        
        # Calculate aggregated statistics
        average_score = statistics.mean(scores)
        median_score = statistics.median(scores)
        score_variance = statistics.variance(scores) if len(scores) > 1 else 0
        
        # For now, use average as final score
        # Later could implement weighted averages based on evaluator experience
        final_score = average_score
        
        aggregated_result = {
            'player_id': player_id,
            'drill_type': drill_type,
            'evaluations': evaluation_details,
            'average_score': average_score,
            'median_score': median_score,
            'score_count': len(scores),
            'score_variance': score_variance,
            'final_score': final_score,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Store aggregated result
        aggregated_ref = db.collection("events").document(event_id).collection("aggregated_drill_results")
        doc_id = f"{player_id}_{drill_type}"
        
        execute_with_timeout(
            lambda: aggregated_ref.document(doc_id).set(aggregated_result),
            timeout=10,
            operation_name="update aggregated result"
        )
        
        logging.info(f"Updated aggregated result for player {player_id}, drill {drill_type}")
        
    except Exception as e:
        logging.error(f"Error updating aggregated drill results: {e}")
        # Don't raise exception here as this is a background operation