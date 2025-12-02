from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from io import BytesIO
from typing import Dict, List, Any

# WooCombine Brand Colors
TEAL_PRIMARY = colors.HexColor("#0D9488") # teal-600
TEAL_LIGHT = colors.HexColor("#F0FDFA")   # teal-50

def generate_event_pdf(event_data: Dict[str, Any], stats: Dict[str, Any], players: List[Dict[str, Any]]) -> BytesIO:
    """
    Generate a PDF report for the event.
    """
    buffer = BytesIO()
    # Use landscape for better table fit
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    title_style.textColor = TEAL_PRIMARY
    
    # Title Section
    elements.append(Paragraph(f"Combine Results: {event_data.get('name', 'Event')}", title_style))
    
    date_str = event_data.get('date', 'N/A')
    location_str = event_data.get('location', 'N/A')
    elements.append(Paragraph(f"Date: {date_str} | Location: {location_str}", styles['Normal']))
    elements.append(Spacer(1, 0.25*inch))
    
    # Summary Metrics Section
    elements.append(Paragraph("Event Summary", styles['Heading2']))
    elements.append(Paragraph(f"Total Participants: {stats['participant_count']}", styles['Normal']))
    elements.append(Spacer(1, 0.15*inch))

    # Drill Highlights (Top 3)
    # Create a grid of drill summaries
    drill_summary_data = []
    row = []
    
    sorted_drills = sorted(stats['drills'].keys())
    
    for i, drill in enumerate(sorted_drills):
        data = stats['drills'][drill]
        drill_name = drill.replace('_', ' ').title()
        
        if data['count'] > 0:
            content = [
                Paragraph(f"<b>{drill_name}</b>", styles['Normal']),
                Paragraph(f"Best: {data['top_performers'][0]['value'] if data['top_performers'] else '-'}", styles['Normal']),
                Paragraph(f"Avg: {data['mean']:.2f}", styles['Normal'])
            ]
        else:
             content = [
                Paragraph(f"<b>{drill_name}</b>", styles['Normal']),
                Paragraph("No Data", styles['Normal'])
            ]
        row.append(content)
        
        if len(row) == 3 or i == len(sorted_drills) - 1:
            drill_summary_data.append(row)
            row = []
            
    if drill_summary_data:
        t_summary = Table(drill_summary_data, colWidths=[3*inch, 3*inch, 3*inch])
        t_summary.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOX', (0,0), (-1,-1), 0.25, colors.grey),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
            ('uP', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        elements.append(t_summary)
        
    elements.append(Spacer(1, 0.25*inch))

    # Full Roster / Results Table
    elements.append(Paragraph("Full Player Results", styles['Heading2']))
    
    # Table Headers
    # Identify active drills (drills with at least one score) to save space?
    # Or just show all. Show all for consistency.
    drill_headers = [d.replace('_', ' ').title() for d in sorted_drills]
    headers = ['Name', '#', 'Age Group'] + drill_headers
    
    table_data = [headers]
    
    # Sort players by name for now
    sorted_players = sorted(players, key=lambda p: (p.get('last_name', ''), p.get('first_name', '')))
    
    for p in sorted_players:
        row = [
            f"{p.get('first_name', '')} {p.get('last_name', '')}",
            str(p.get('jersey_number', '')),
            str(p.get('age_group', ''))
        ]
        for key in sorted_drills:
            val = p.get(key)
            row.append(str(val) if val is not None else "-")
        table_data.append(row)
        
    # Table Style
    t = Table(table_data)
    
    # Alternate row colors
    row_colors = []
    for i in range(len(table_data)):
        if i == 0:
            row_colors.append(TEAL_PRIMARY) # Header
        elif i % 2 == 0:
            row_colors.append(colors.white)
        else:
            row_colors.append(TEAL_LIGHT)

    ts = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL_PRIMARY),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'), # Header align
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        
        # Body
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'), # Center numbers and scores
        ('FONTSIZE', (0, 1), (-1, -1), 9),
    ])
    
    # Apply row backgrounds
    for i in range(1, len(table_data)):
        bg = TEAL_LIGHT if i % 2 == 0 else colors.white
        ts.add('BACKGROUND', (0, i), (-1, i), bg)
        
    t.setStyle(ts)
    elements.append(t)
    
    # Footer
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(f"Generated by WooCombine on {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Italic']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

