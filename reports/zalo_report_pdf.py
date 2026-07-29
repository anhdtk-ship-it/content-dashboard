#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Weekly Report ZALO — PDF cho Leader (reportlab.platypus). ĐỘC LẬP với PDF Facebook.
Phong cách Business Dashboard: A4 DỌC, KHÔNG QR, bảng màu giới hạn (XANH/VÀNG/ĐỎ/XÁM).
Chia toàn bộ theo ĐỊNH DẠNG (động — không hardcode Video/Banner).

Dữ liệu: reports/report_zalo.json (sinh bởi reports/build_zalo_weekly_data.ts, dùng CHUNG
module src/platform/zalo/zaloWeeklyMetrics.ts với Dashboard Weekly Zalo) => KHÔNG lệch số.

Bố cục: Header · I. Tổng quan · II+IV So sánh định dạng · III. Cần xử lý · V. Đề xuất tuần tới.

Chạy:
  pip install reportlab
  npx ts-node reports/build_zalo_weekly_data.ts --from 2026-07-21 --to 2026-07-27 --out reports/report_zalo.json
  python reports/zalo_report_pdf.py --data reports/report_zalo.json --out reports/zalo_weekly.pdf
"""
import argparse
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

# ================= BẢNG MÀU =================
XANH = colors.HexColor('#0F766E')
VANG = colors.HexColor('#D97706')
DO = colors.HexColor('#DC2626')
INK = colors.HexColor('#1F2933')
XAM = colors.HexColor('#6B7280')
XAM_LINE = colors.HexColor('#D8DEE6')
XAM_BG = colors.HexColor('#F3F5F7')
XAM_BG2 = colors.HexColor('#E7EBEF')

LOW_TEST_RATE = 0.70
GOOD_DUYTRI_RATE = 0.10
HIGH_TON = 3


def register_fonts():
    regular = [r'C:\Windows\Fonts\segoeui.ttf', r'C:\Windows\Fonts\arial.ttf',
               '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf']
    bold = [r'C:\Windows\Fonts\segoeuib.ttf', r'C:\Windows\Fonts\arialbd.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
    reg = next((p for p in regular if os.path.exists(p)), None)
    bld = next((p for p in bold if os.path.exists(p)), None)
    if reg:
        pdfmetrics.registerFont(TTFont('App', reg))
        pdfmetrics.registerFont(TTFont('App-Bold', bld or reg))
        return 'App', 'App-Bold'
    sys.stderr.write('⚠️  Không thấy TTF Unicode → Helvetica (tiếng Việt có thể lỗi dấu).\n')
    return 'Helvetica', 'Helvetica-Bold'


FONT, FONT_B = register_fonts()


def vnum(n):
    try:
        return f'{int(n):,}'.replace(',', '.')
    except Exception:
        return str(n)


def vpct(x):
    try:
        return f'{round(float(x) * 1000) / 10:g}%'
    except Exception:
        return '0%'


def S():
    ss = getSampleStyleSheet()
    d = {}
    d['title'] = ParagraphStyle('t', parent=ss['Normal'], fontName=FONT_B, fontSize=18, textColor=INK, leading=22)
    d['sub'] = ParagraphStyle('s', parent=ss['Normal'], fontName=FONT, fontSize=9, textColor=XAM, leading=12)
    d['subR'] = ParagraphStyle('sr', parent=d['sub'], alignment=TA_RIGHT)
    d['h1'] = ParagraphStyle('h1', parent=ss['Normal'], fontName=FONT_B, fontSize=12, textColor=colors.white, leading=15)
    d['h3'] = ParagraphStyle('h3', parent=ss['Normal'], fontName=FONT_B, fontSize=9.5, textColor=XANH, leading=12)
    d['body'] = ParagraphStyle('b', parent=ss['Normal'], fontName=FONT, fontSize=9, textColor=INK, leading=12.5)
    d['cardnum'] = ParagraphStyle('cn', parent=ss['Normal'], fontName=FONT_B, fontSize=15, alignment=TA_CENTER, leading=17)
    d['cardlbl'] = ParagraphStyle('cl', parent=ss['Normal'], fontName=FONT, fontSize=7, textColor=XAM, alignment=TA_CENTER, leading=8.5)
    d['th'] = ParagraphStyle('th', parent=ss['Normal'], fontName=FONT_B, fontSize=8, textColor=INK, alignment=TA_CENTER, leading=10)
    d['thL'] = ParagraphStyle('thl', parent=d['th'], alignment=TA_LEFT)
    d['td'] = ParagraphStyle('td', parent=ss['Normal'], fontName=FONT, fontSize=8.6, textColor=INK, alignment=TA_CENTER, leading=11)
    d['tdL'] = ParagraphStyle('tdl', parent=ss['Normal'], fontName=FONT_B, fontSize=8.6, textColor=INK, alignment=TA_LEFT, leading=11)
    return d


def c_header(rep, st, width):
    left = Paragraph('BÁO CÁO CONTENT TUẦN — ZALO', st['title'])
    right = Paragraph(f"Kỳ: <b>{rep['range']['label']}</b><br/>Ngày xuất: {rep.get('exportedAt', '')}", st['subR'])
    t = Table([[left, right]], colWidths=[width * 0.64, width * 0.36])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 1.6, XANH),
    ]))
    return t


def c_section(title, st, width):
    t = Table([[Paragraph(title, st['h1'])]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), XANH),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def _tone_rate_test(v):
    return XANH if v >= LOW_TEST_RATE else (VANG if v >= LOW_TEST_RATE * 0.7 else DO)


def _tone_ton(v):
    return DO if v >= HIGH_TON * 2 else (VANG if v > 0 else XANH)


# ---- I. KPI card / định dạng (4 thẻ) ----
def c_kpi_cards(k, st, width):
    items = [
        ('Đã cấp', vnum(k['capped']), INK),
        ('Đã test', vnum(k['tested']), INK),
        ('Tồn', vnum(k['ton']), _tone_ton(k['ton'])),
        ('Duy trì', vnum(k['duyTri']), XANH),
    ]
    row = []
    for label, val, tone in items:
        numst = ParagraphStyle('n', parent=st['cardnum'], textColor=tone)
        row.append([Paragraph(val, numst), Paragraph(label, st['cardlbl'])])
    cw = width / 4.0
    t = Table([row], colWidths=[cw] * 4, rowHeights=[1.35 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), XAM_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, XAM_LINE),
        ('INNERGRID', (0, 0), (-1, -1), 3, colors.white),
        ('LINEABOVE', (0, 0), (-1, 0), 1.6, XANH),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t


# ---- II+IV. Bảng so sánh theo định dạng ----
CMP_COLS = ['Định dạng', 'Đã cấp', 'Đã test', 'Tồn', 'Duy trì', 'Tỷ lệ test', 'Tỷ lệ duy trì']


def _cmp_row(k, st, name, bold=False):
    style = st['td'] if not bold else ParagraphStyle('tb', parent=st['td'], fontName=FONT_B)
    ton_st = ParagraphStyle('tn', parent=style, textColor=_tone_ton(k['ton']))
    rt_st = ParagraphStyle('rt', parent=style, textColor=_tone_rate_test(k['rateTest']))
    dt_st = ParagraphStyle('dt', parent=style, textColor=XANH)
    return [
        Paragraph(name, st['tdL']),
        Paragraph(vnum(k['capped']), style), Paragraph(vnum(k['tested']), style),
        Paragraph(vnum(k['ton']), ton_st), Paragraph(vnum(k['duyTri']), dt_st),
        Paragraph(vpct(k['rateTest']), rt_st), Paragraph(vpct(k['rateDuyTri']), style),
    ]


def c_compare_table(rep, st, width):
    data = [[Paragraph(CMP_COLS[0], st['thL'])] + [Paragraph(c, st['th']) for c in CMP_COLS[1:]]]
    for k in rep['byFormat']:
        data.append(_cmp_row(k, st, k['label']))
    data.append(_cmp_row(rep['team'], st, 'TỔNG', bold=True))
    name_w = 3.6 * cm
    numw = (width - name_w) / 6.0
    t = Table(data, colWidths=[name_w] + [numw] * 6, repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), XAM_BG2),
        ('GRID', (0, 0), (-1, -1), 0.4, XAM_LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('BACKGROUND', (0, -1), (-1, -1), XAM_BG2),
        ('LINEABOVE', (0, -1), (-1, -1), 0.9, XAM),
    ]
    for i in range(1, len(rep['byFormat']) + 1):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#FAFBFC')))
    t.setStyle(TableStyle(style))
    return t


# ---- III. Cần xử lý (ưu tiên: Test quá lâu → Thiếu ngày test → Chưa phân loại → Chưa test) ----
ATTN_COLS = ['Định dạng', 'Test quá lâu', 'Thiếu ngày test', 'Chưa phân loại', 'Chưa test']
ATTN_KEYS = ['testQuaLau', 'thieuNgayTest', 'chuaPhanLoai', 'chuaTest']


def c_attention_table(rep, st, width):
    data = [[Paragraph(ATTN_COLS[0], st['thL'])] + [Paragraph(c, st['th']) for c in ATTN_COLS[1:]]]
    for a in rep['attention']:
        cells = [Paragraph(a['label'], st['tdL'])]
        for key in ATTN_KEYS:
            v = a.get(key, 0)
            cst = ParagraphStyle('a', parent=st['td'], textColor=(DO if v > 0 else XAM))
            cells.append(Paragraph(vnum(v), cst))
        data.append(cells)
    name_w = 4.0 * cm
    numw = (width - name_w) / 4.0
    t = Table(data, colWidths=[name_w] + [numw] * 4, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), XAM_BG2),
        ('GRID', (0, 0), (-1, -1), 0.4, XAM_LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
    ]))
    return t


def _footer(canv, doc):
    canv.saveState()
    canv.setStrokeColor(XAM_LINE)
    canv.setLineWidth(0.5)
    y = 1.05 * cm
    canv.line(doc.leftMargin, y + 10, doc.leftMargin + doc.width, y + 10)
    canv.setFont(FONT, 7.5)
    canv.setFillColor(XAM)
    canv.drawString(doc.leftMargin, y, 'Content Operations · Báo cáo nội bộ Zalo')
    canv.drawRightString(doc.leftMargin + doc.width, y, f'Trang {canv.getPageNumber()}')
    canv.restoreState()


def build(rep, out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm, topMargin=1.3 * cm, bottomMargin=1.7 * cm,
        title='Báo cáo Content tuần — Zalo', author='Content Operations Dashboard',
    )
    w = doc.width
    st = S()
    narrative = rep.get('narrative', {})
    story = []

    story.append(c_header(rep, st, w))
    story.append(Spacer(1, 12))

    # I. Tổng quan
    story.append(c_section('I. TỔNG QUAN THEO ĐỊNH DẠNG', st, w))
    story.append(Spacer(1, 8))
    for k in rep['byFormat']:
        story.append(KeepTogether([
            Paragraph(k['label'], st['h3']), Spacer(1, 3),
            c_kpi_cards(k, st, w), Spacer(1, 10),
        ]))

    # II + IV. So sánh định dạng
    story.append(Spacer(1, 2))
    story.append(c_section('II. TIẾN ĐỘ SỬ DỤNG & IV. SO SÁNH HIỆU QUẢ THEO ĐỊNH DẠNG', st, w))
    story.append(Spacer(1, 8))
    story.append(c_compare_table(rep, st, w))
    story.append(Spacer(1, 12))

    # III. Cần xử lý
    story.append(c_section('III. CẦN XỬ LÝ', st, w))
    story.append(Spacer(1, 8))
    story.append(c_attention_table(rep, st, w))
    story.append(Spacer(1, 12))

    # V. Đề xuất
    story.append(c_section('V. ĐỀ XUẤT TUẦN TỚI', st, w))
    story.append(Spacer(1, 8))
    for it in [x for x in narrative.get('plans', []) if str(x).strip()]:
        story.append(Paragraph(f"☐&nbsp;&nbsp;{it.replace('&', '&amp;')}", st['body']))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    print(f'✅ Đã tạo PDF: {out_path}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default='reports/report_zalo.json')
    ap.add_argument('--out', default='reports/zalo_weekly.pdf')
    a = ap.parse_args()
    with open(a.data, 'r', encoding='utf-8') as f:
        rep = json.load(f)
    build(rep, a.out)


if __name__ == '__main__':
    main()
