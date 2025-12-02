import csv
import io
import logging
from typing import List, Dict, Any, Optional, Tuple
import openpyxl
from datetime import datetime
from .validation import validate_drill_score, get_unit_for_drill, DRILL_SCORE_RANGES

logger = logging.getLogger(__name__)

class ImportResult:
    def __init__(self, valid_rows: List[Dict[str, Any]], errors: List[Dict[str, Any]]):
        self.valid_rows = valid_rows
        self.errors = errors

class DataImporter:
    """
    Utility class to parse and normalize input data (CSV, Excel, Text)
    into a standardized list of player objects with drill results.
    """
    
    REQUIRED_HEADERS = ['first_name', 'last_name']
    OPTIONAL_HEADERS = ['age_group', 'jersey_number', 'email', 'phone', 'position']
    
    # Map common variations to canonical field names
    FIELD_MAPPING = {
        'first': 'first_name',
        'fname': 'first_name',
        'firstname': 'first_name',
        'last': 'last_name',
        'lname': 'last_name',
        'lastname': 'last_name',
        'jersey': 'jersey_number',
        'number': 'jersey_number',
        'no': 'jersey_number',
        '#': 'jersey_number',
        'age': 'age_group',
        'group': 'age_group',
        'division': 'age_group',
        'pos': 'position'
    }

    @staticmethod
    def _normalize_header(header: str) -> str:
        """Normalize header string to match canonical field names"""
        if not header:
            return ""
        
        clean = str(header).strip().lower().replace(' ', '_').replace('-', '_')
        
        # Check exact matches first
        if clean in DataImporter.FIELD_MAPPING:
            return DataImporter.FIELD_MAPPING[clean]
            
        # Check if it matches any drill keys
        if clean in DRILL_SCORE_RANGES:
            return clean
            
        # Check if it looks like a drill (e.g. "40_yard_dash" -> "40m_dash")
        if '40' in clean and 'dash' in clean:
            return '40m_dash'
        if 'jump' in clean or 'vert' in clean:
            return 'vertical_jump'
        if 'catch' in clean:
            return 'catching'
        if 'throw' in clean:
            return 'throwing'
        if 'agil' in clean or 'l_drill' in clean:
            return 'agility'
            
        return clean

    @staticmethod
    def parse_csv(content: bytes) -> ImportResult:
        """Parse CSV content"""
        try:
            # Decode bytes to string
            text = content.decode('utf-8-sig') # Handle BOM if present
            f = io.StringIO(text)
            reader = csv.DictReader(f)
            
            # Normalize headers
            if not reader.fieldnames:
                return ImportResult([], [{"row": 0, "message": "Empty CSV file"}])
                
            normalized_field_map = {
                field: DataImporter._normalize_header(field) 
                for field in reader.fieldnames
            }
            
            return DataImporter._process_rows(reader, normalized_field_map)
            
        except Exception as e:
            logger.error(f"CSV Parse Error: {e}")
            return ImportResult([], [{"row": 0, "message": f"Failed to parse CSV: {str(e)}"}])

    @staticmethod
    def parse_excel(content: bytes) -> ImportResult:
        """Parse Excel (XLSX) content"""
        try:
            wb = openpyxl.load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            
            rows = list(ws.rows)
            if not rows:
                return ImportResult([], [{"row": 0, "message": "Empty Excel file"}])
                
            # Extract headers from first row
            header_cells = rows[0]
            headers = [str(cell.value or "").strip() for cell in header_cells]
            
            # Map headers
            normalized_field_map = {
                headers[i]: DataImporter._normalize_header(headers[i])
                for i in range(len(headers))
            }
            
            # Convert to dict list for processing
            data_rows = []
            for row_idx, row in enumerate(rows[1:], start=2):
                row_data = {}
                has_data = False
                for col_idx, cell in enumerate(row):
                    if col_idx < len(headers):
                        key = headers[col_idx]
                        val = cell.value
                        if val is not None and str(val).strip() != "":
                            row_data[key] = val
                            has_data = True
                if has_data:
                    data_rows.append(row_data)
            
            return DataImporter._process_rows(data_rows, normalized_field_map)
            
        except Exception as e:
            logger.error(f"Excel Parse Error: {e}")
            return ImportResult([], [{"row": 0, "message": f"Failed to parse Excel file: {str(e)}"}])

    @staticmethod
    def parse_text(text: str) -> ImportResult:
        """
        Parse pasted text. Assumes either CSV-like structure or specific format.
        For now, implements a robust delimiter sniffer (tab, comma, pipe).
        """
        try:
            # Trim and split lines
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            if not lines:
                return ImportResult([], [{"row": 0, "message": "No text provided"}])
                
            # Sniff delimiter from header row
            header_line = lines[0]
            delimiters = ['\t', ',', '|', ';']
            best_delimiter = ','
            max_cols = 0
            
            for d in delimiters:
                cols = len(header_line.split(d))
                if cols > max_cols:
                    max_cols = cols
                    best_delimiter = d
            
            # Parse using CSV reader with detected delimiter
            f = io.StringIO(text)
            reader = csv.DictReader(f, delimiter=best_delimiter)
            
            if not reader.fieldnames:
                return ImportResult([], [{"row": 0, "message": "Could not parse headers"}])

            normalized_field_map = {
                field: DataImporter._normalize_header(field) 
                for field in reader.fieldnames
            }
            
            return DataImporter._process_rows(reader, normalized_field_map)
            
        except Exception as e:
            logger.error(f"Text Parse Error: {e}")
            return ImportResult([], [{"row": 0, "message": f"Failed to parse text: {str(e)}"}])

    @staticmethod
    def _process_rows(rows: Any, field_map: Dict[str, str]) -> ImportResult:
        """Common processing logic for all input types"""
        valid_rows = []
        errors = []
        
        # Identify which columns map to drill scores
        drill_keys = set(DRILL_SCORE_RANGES.keys())
        
        for idx, row in enumerate(rows, start=1):
            processed_row = {}
            row_errors = []
            
            # Map fields
            for original_key, value in row.items():
                mapped_key = field_map.get(original_key)
                if not mapped_key:
                    continue
                    
                clean_val = str(value).strip() if value is not None else ""
                
                if mapped_key in drill_keys and clean_val:
                    try:
                        # Validate drill score immediately
                        float_val = float(clean_val)
                        # We don't hard-fail here on range, we just mark it?
                        # Actually, let's just store the raw value for now and let the next step validate,
                        # OR validate strictly here.
                        # The requirement says: "Any invalid/missing scores... Option to correct fields"
                        # So we should flag invalid scores but maybe keep the row?
                        # Let's validation logic:
                        try:
                            validate_drill_score(float_val, mapped_key)
                            processed_row[mapped_key] = float_val
                        except Exception as e:
                            row_errors.append(f"Invalid {mapped_key}: {str(e)}")
                            # Keep the raw value so user can see what was wrong?
                            # For simplicity, we omit invalid values from 'processed_row' but add error
                            processed_row[f"{mapped_key}_raw"] = clean_val
                            
                    except ValueError:
                         row_errors.append(f"Invalid number format for {mapped_key}: '{clean_val}'")
                         processed_row[f"{mapped_key}_raw"] = clean_val
                
                elif mapped_key == 'jersey_number' and clean_val:
                    try:
                        num = int(float(clean_val)) # Handle "10.0" from Excel
                        processed_row[mapped_key] = num
                    except ValueError:
                        row_errors.append(f"Invalid jersey number: {clean_val}")
                        processed_row[f"{mapped_key}_raw"] = clean_val
                
                else:
                    # Regular string fields
                    if clean_val:
                        processed_row[mapped_key] = clean_val

            # Check required fields
            if 'first_name' not in processed_row or not processed_row['first_name']:
                row_errors.append("Missing First Name")
            if 'last_name' not in processed_row or not processed_row['last_name']:
                row_errors.append("Missing Last Name")
                
            # Construct result item
            item = {
                "row_id": idx,
                "data": processed_row,
                "errors": row_errors,
                "original": str(row) # Debug helper
            }
            
            if row_errors:
                errors.append({
                    "row": idx,
                    "data": processed_row,
                    "message": "; ".join(row_errors)
                })
            else:
                valid_rows.append(item)
                
        return ImportResult(valid_rows, errors)

