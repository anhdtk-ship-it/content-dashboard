#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Weekly Report — PDF export (reportlab.platypus).
Nâng cấp phần TRÌNH BÀY. KHÔNG đổi Business Rule / KPI / Dashboard.

Đọc dữ liệu đã tính sẵn (report.json — sinh bởi reports/build_weekly_data.ts,
số liệu KHỚP WeeklyReportService) và render PDF A4 dọc, 1 trang nếu đủ chỗ.

Bố cục:  I. Tiến độ Content (6 KPI card + bảng Tổng quan Team)
         II. Đánh giá (theo từng nhân viên, dựa trên KPI thật)
         III. Phương án tuần tới (hành động ngắn gọn, quản trị)

Chạy:  pip install reportlab
       python reports/weekly_report_pdf.py --data reports/report.json --out reports/weekly_report.pdf

Chỉ dùng platypus (SimpleDocTemplate/Paragraph/Table/...), KHÔNG dựng bằng canvas.
"""
import argparse
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

# ---------- Bảng màu (tối giản: mực đậm + xám + 1 nhấn xanh) ----------
INK     = colors.HexColor('#0f172a')   # tiêu đề / chữ chính
MUTED   = colors.HexColor('#64748b')   # nhãn phụ
ACCENT  = colors.HexColor('#0f766e')   # nhấn (gạch tiêu đề, viền card)
CARD_BG = colors.HexColor('#f1f5f9')   # nền card / header bảng
ZEBRA   = colors.HexColor('#f8fafc')   # nền dòng chẵn
LINE    = colors.HexColor('#cbd5e1')   # đường kẻ
TOTAL_BG = colors.HexColor('#e2e8f0')  # nền dòng Tổng


# ---------- Font Unicode (tiếng Việt) — reportlab mặc định KHÔNG có dấu ----------
def register_fonts():
    regular_candidates = [
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\segoeui.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/Library/Fonts/Arial.ttf',
    ]
    bold_candidates = [
        r'C:\Windows\Fonts\arialbd.ttf',
        r'C:\Windows\Fonts\segoeuib.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    reg = next((p for p in regular_candidates if os.path.exists(p)), None)
    bold = next((p for p in bold_candidates if os.path.exists(p)), None)
    if reg:
        pdfmetrics.registerFont(TTFont('App', reg))
        pdfmetrics.registerFont(TTFont('App-Bold', bold or reg))
        return 'App', 'App-Bold'
    # Fallback: Helvetica (CẢNH BÁO: tiếng Việt có dấu có thể không hiển thị đúng).
    sys.stderr.write('⚠️  Không tìm thấy TTF Unicode → dùng Helvetica (tiếng Việt có thể lỗi dấu).\n')
    return 'Helvetica', 'Helvetica-Bold'


FONT, FONT_B = register_fonts()


def vnum(n):
    """Số nguyên nhóm hàng nghìn kiểu VN (dấu chấm)."""
    try:
        return f'{int(n):,}'.replace(',', '.')
    except Exception:
        return str(n)


# ---------- Styles ----------
def styles():
    ss = getSampleStyleSheet()
    S = {}
    S['title']   = ParagraphStyle('t', parent=ss['Normal'], fontName=FONT_B, fontSize=17, textColor=INK, leading=21)
    S['sub']     = ParagraphStyle('s', parent=ss['Normal'], fontName=FONT, fontSize=9.5, textColor=MUTED, leading=13)
    S['section'] = ParagraphStyle('h', parent=ss['Normal'], fontName=FONT_B, fontSize=12.5, textColor=colors.white, leading=16)
    S['emp']     = ParagraphStyle('e', parent=ss['Normal'], fontName=FONT_B, fontSize=10, textColor=INK, leading=13, spaceBefore=4)
    S['body']    = ParagraphStyle('b', parent=ss['Normal'], fontName=FONT, fontSize=9.5, textColor=INK, leading=13.5)
    S['cardnum'] = ParagraphStyle('cn', parent=ss['Normal'], fontName=FONT_B, fontSize=19, textColor=INK, alignment=TA_CENTER, leading=21)
    S['cardlbl'] = ParagraphStyle('cl', parent=ss['Normal'], fontName=FONT, fontSize=8.5, textColor=MUTED, alignment=TA_CENTER, leading=11)
    S['th']      = ParagraphStyle('th', parent=ss['Normal'], fontName=FONT_B, fontSize=8.8, textColor=INK, alignment=TA_CENTER, leading=11)
    S['tdL']     = ParagraphStyle('tdl', parent=ss['Normal'], fontName=FONT_B, fontSize=9.2, textColor=INK, alignment=TA_LEFT, leading=12)
    S['td']      = ParagraphStyle('td', parent=ss['Normal'], fontName=FONT, fontSize=9.2, textColor=INK, alignment=TA_CENTER, leading=12)
    return S


def section_bar(text, S, width):
    """Thanh tiêu đề mục (nền xanh nhấn, chữ trắng) — nổi bật, ít màu."""
    t = Table([[Paragraph(text, S['section'])]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


# 6 KPI hiển thị (nhãn PDF · khóa trong metrics). "Content Duy trì" = win (đã đổi tên).
KPI_DEFS = [
    ('Đã cấp', 'capped'),
    ('Đã test', 'tested'),
    ('Không test', 'notTest'),
    ('Chờ chạy', 'choChay'),
    ('Đang test', 'dangTest'),
    ('Content Duy trì', 'win'),
]


def kpi_cards(team, S, width):
    """6 card KPI (3 cột × 2 hàng) đồng đều."""
    cells = []
    for label, key in KPI_DEFS:
        cells.append([Paragraph(vnum(team.get(key, 0)), S['cardnum']), Paragraph(label, S['cardlbl'])])
    rows = [cells[0:3], cells[3:6]]
    cw = width / 3.0
    t = Table(rows, colWidths=[cw, cw, cw], rowHeights=[1.55 * cm, 1.55 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('BOX', (0, 0), (-1, -1), 0.6, LINE),
        ('INNERGRID', (0, 0), (-1, -1), 3, colors.white),  # khe trắng giữa các card
        ('LINEABOVE', (0, 0), (-1, 0), 2, ACCENT),         # gạch nhấn phía trên hàng card đầu
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def team_table(team, employees, S, width):
    """Bảng Tổng quan Team: dòng NV + Tổng; cột 6 KPI."""
    head = ['Nhân viên', 'Đã cấp', 'Đã test', 'Không test', 'Chờ chạy', 'Đang test', 'Content Duy trì']
    data = [[Paragraph(h, S['th']) for h in head]]
    for e in employees:
        m = e['metrics']
        data.append([
            Paragraph(e['name'], S['tdL']),
            Paragraph(vnum(m['capped']), S['td']), Paragraph(vnum(m['tested']), S['td']),
            Paragraph(vnum(m['notTest']), S['td']), Paragraph(vnum(m['choChay']), S['td']),
            Paragraph(vnum(m['dangTest']), S['td']), Paragraph(vnum(m['win']), S['td']),
        ])
    data.append([
        Paragraph('Tổng', S['tdL']),
        Paragraph(vnum(team['capped']), S['td']), Paragraph(vnum(team['tested']), S['td']),
        Paragraph(vnum(team['notTest']), S['td']), Paragraph(vnum(team['choChay']), S['td']),
        Paragraph(vnum(team['dangTest']), S['td']), Paragraph(vnum(team['win']), S['td']),
    ])
    name_w = 3.2 * cm
    num_w = (width - name_w) / 6.0
    t = Table(data, colWidths=[name_w] + [num_w] * 6, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), CARD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, LINE),
        ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, -1), (-1, -1), TOTAL_BG),   # dòng Tổng
        ('LINEABOVE', (0, -1), (-1, -1), 0.8, MUTED),
    ]
    for i in range(1, len(employees) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(style))
    return t


def narrative_block(title, employees, key, S, width):
    """II hoặc III: theo từng nhân viên, mỗi ý 1 dòng bullet.
    Giữ MỖI nhân viên không bị tách (KeepTogether), nhưng để mục tự trôi
    → ưu tiên gói gọn 1 trang, chỉ sang trang 2 khi thật sự thiếu chỗ."""
    flow = [section_bar(title, S, width), Spacer(1, 4)]
    for e in employees:
        sub = [Paragraph(e['name'], S['emp'])]
        for it in e.get(key, []):
            sub.append(Paragraph(f'•&nbsp;&nbsp;{it}', S['body']))
        sub.append(Spacer(1, 3))
        flow.append(KeepTogether(sub))
    return flow


def build(report, out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=1.4 * cm, bottomMargin=1.4 * cm,
        title='Báo cáo tuần — Content', author='Content Ops Dashboard',
    )
    width = doc.width
    S = styles()
    team = report['team']
    employees = report['employees']
    label = report.get('range', {}).get('label', '')

    story = []
    story.append(Paragraph('BÁO CÁO TUẦN — CONTENT', S['title']))
    story.append(Paragraph(f'Kỳ: {label}  ·  Team Seryn', S['sub']))
    story.append(Spacer(1, 8))

    # I. TIẾN ĐỘ CONTENT
    story.append(section_bar('I. TIẾN ĐỘ CONTENT', S, width))
    story.append(Spacer(1, 6))
    story.append(kpi_cards(team, S, width))
    story.append(Spacer(1, 8))
    story.append(Paragraph('Tổng quan Team', S['emp']))
    story.append(Spacer(1, 3))
    story.append(team_table(team, employees, S, width))
    story.append(Spacer(1, 10))

    # II. ĐÁNH GIÁ
    blk2 = narrative_block('II. ĐÁNH GIÁ', employees, 'assessments', S, width)
    story.extend(blk2 if isinstance(blk2, list) else [blk2])
    story.append(Spacer(1, 8))

    # III. PHƯƠNG ÁN TUẦN TỚI
    blk3 = narrative_block('III. PHƯƠNG ÁN TUẦN TỚI', employees, 'actions', S, width)
    story.extend(blk3 if isinstance(blk3, list) else [blk3])

    doc.build(story)
    print(f'✅ Đã tạo PDF: {out_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='reports/report.json')
    ap.add_argument('--out', default='reports/weekly_report.pdf')
    args = ap.parse_args()
    with open(args.data, 'r', encoding='utf-8') as f:
        report = json.load(f)
    build(report, args.out)


if __name__ == '__main__':
    main()
