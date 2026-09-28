from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "aair-labeling-guidelines.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

BLUE = colors.HexColor("#087FA8")
INK = colors.HexColor("#20313D")
MUTED = colors.HexColor("#617480")
LINE = colors.HexColor("#D7E1E6")
PALE = colors.HexColor("#EDF7FA")
AMBER = colors.HexColor("#FFF4D7")


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BLUE)
    canvas.rect(0, A4[1] - 14 * mm, A4[0], 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Arial-Bold", 9)
    canvas.drawString(18 * mm, A4[1] - 9 * mm, "AAIR LAB  |  HƯỚNG DẪN GÁN NHÃN")
    canvas.setFillColor(MUTED)
    canvas.setFont("Arial", 8)
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Trang {doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleVN", fontName="Arial-Bold", fontSize=23, leading=28, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="LeadVN", fontName="Arial", fontSize=10.5, leading=16, textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="H1VN", fontName="Arial-Bold", fontSize=15, leading=19, textColor=BLUE, spaceBefore=10, spaceAfter=7))
styles.add(ParagraphStyle(name="H2VN", fontName="Arial-Bold", fontSize=11, leading=14, textColor=INK, spaceBefore=7, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyVN", fontName="Arial", fontSize=9.5, leading=14, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallVN", fontName="Arial", fontSize=8.5, leading=12, textColor=MUTED))
styles.add(ParagraphStyle(name="CenterVN", parent=styles["BodyVN"], alignment=TA_CENTER))


def p(text, style="BodyVN"):
    return Paragraph(text, styles[style])


doc = BaseDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    topMargin=22 * mm,
    bottomMargin=19 * mm,
    title="AAIR Lab - Hướng dẫn gán nhãn báo cáo tài chính",
    author="AAIR Lab",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
doc.addPageTemplates(PageTemplate(id="guide", frames=[frame], onPage=page))

story = [
    Spacer(1, 4 * mm),
    p("Hướng dẫn gán nhãn<br/>báo cáo tài chính PDF", "TitleVN"),
    p("Tài liệu dành cho AI Labeler, Manual Labeler, Reviewer và Result Analyst trong hệ thống AAIR Lab. Danh sách section trong hệ thống là động: tên section được lấy từ kết quả trích xuất thực tế, không bị giới hạn ở các ví dụ dưới đây.", "LeadVN"),
    p("1. Quy trình làm việc", "H1VN"),
]

workflow = [
    [p("BƯỚC", "SmallVN"), p("THAO TÁC", "SmallVN"), p("KẾT QUẢ MONG ĐỢI", "SmallVN")],
    [p("01", "H2VN"), p("Đọc PDF và xác định đúng nhãn nguồn."), p("Có trang nguồn và vùng highlight nếu xác định được tọa độ.")],
    [p("02", "H2VN"), p("Nhập tên section, giá trị và mức tin cậy."), p("Tên section ngắn gọn, ổn định; giá trị giữ nguyên ý nghĩa tài liệu.")],
    [p("03", "H2VN"), p("Lưu để kiểm tra, sau đó Submit khi hoàn tất."), p("Section chuyển từ SAVED sang SUBMITTED và được đưa vào kiểm duyệt.")],
    [p("04", "H2VN"), p("Reviewer so sánh nguồn A/B và chốt giá trị."), p("Mọi khác biệt định dạng hoặc giá trị đều được xác nhận rõ ràng.")],
]
table = Table(workflow, colWidths=[18 * mm, 73 * mm, 80 * mm], repeatRows=1)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BLUE), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, -1), "Arial"), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), .5, LINE), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story += [table, p("2. Nguyên tắc chung", "H1VN"), p("• Chỉ ghi giá trị có bằng chứng trong PDF; không suy diễn từ kiến thức bên ngoài."), p("• Dùng số trang PDF thực tế làm <b>source_page</b>. Nếu có bbox, vùng chọn phải bao đúng dòng hoặc ô bảng chứa giá trị."), p("• Giữ đơn vị tiền tệ, kỳ báo cáo và dấu âm. Không tự quy đổi đơn vị nếu tài liệu không yêu cầu."), p("• Một tài liệu có thể phát sinh section mới. Dùng cùng một tên cho cùng một khái niệm để hệ thống ghép A/B chính xác."), p("3. Các section thường gặp", "H1VN")]

fields = [
    ("COMPANY_NAME", "Tên pháp lý đầy đủ của doanh nghiệp phát hành báo cáo.", "CÔNG TY CỔ PHẦN 28.1"),
    ("INDUSTRY", "Ngành nghề hoặc lĩnh vực kinh doanh chính được tài liệu nêu rõ.", "Sản xuất, thương mại và dịch vụ may mặc"),
    ("REPORT_PERIOD", "Kỳ báo cáo đầy đủ, có thể là quý, bán niên hoặc năm tài chính.", "Năm tài chính kết thúc ngày 31/12/2024"),
    ("REPORT_YEAR", "Năm đại diện cho kỳ báo cáo, ghi bốn chữ số.", "2024"),
    ("REVENUE", "Doanh thu theo chỉ tiêu được báo cáo; giữ đơn vị và dấu âm nếu có.", "262.611.441.370 VND"),
]
field_rows = [[p("SECTION", "SmallVN"), p("CÁCH XÁC ĐỊNH", "SmallVN"), p("VÍ DỤ", "SmallVN")]] + [[p(name, "H2VN"), p(rule), p(example)] for name, rule, example in fields]
field_table = Table(field_rows, colWidths=[38 * mm, 86 * mm, 47 * mm], repeatRows=1)
field_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), .5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFBFC")]),
    ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story += [field_table, p("Section bổ sung", "H2VN"), p("Nếu tài liệu có chỉ tiêu cần thiết ngoài danh sách trên, Manual Labeler được phép tạo section mới. Tên nên viết HOA, dùng dấu gạch dưới giữa các từ, ví dụ <b>PROFIT_AFTER_TAX</b>. Reviewer sẽ thấy hợp tất cả section từ hai nguồn, kể cả section chỉ xuất hiện ở một phía."), p("4. Xử lý khác biệt A/B", "H1VN")]

diff_rows = [
    [p("TRẠNG THÁI", "SmallVN"), p("Ý NGHĨA", "SmallVN"), p("HÀNH ĐỘNG REVIEWER", "SmallVN")],
    [p("EXACT", "H2VN"), p("Hai giá trị giống nhau sau khi bỏ khoảng trắng thừa."), p("Kiểm tra nguồn; giá trị được điền sẵn khi hoàn thành case.")],
    [p("FORMAT_ONLY", "H2VN"), p("Cùng giá trị nhưng khác cách viết, ví dụ 1.000 và 1,000."), p("Vẫn phải chọn A, B hoặc nhập giá trị chuẩn.")],
    [p("VALUE_DIFFERENT", "H2VN"), p("Hai nguồn thể hiện nội dung hoặc số liệu khác nhau."), p("Đối chiếu PDF, chọn đúng hoặc nhập giá trị khác.")],
    [p("MISSING", "H2VN"), p("Section chỉ có ở một nguồn."), p("Xác minh PDF và quyết định giữ hay nhập lại giá trị.")],
]
diff_table = Table(diff_rows, colWidths=[35 * mm, 66 * mm, 70 * mm], repeatRows=1)
diff_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BLUE), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), .5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
    ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story += [diff_table, Spacer(1, 5 * mm), Table([[p("Lưu ý", "H2VN"), p("Khác định dạng không đồng nghĩa với sai số liệu. Hệ thống chỉ cảnh báo; Reviewer là người xác nhận giá trị chính thức.")]], colWidths=[25 * mm, 146 * mm], style=TableStyle([("BACKGROUND",(0,0),(-1,-1),AMBER),("BOX",(0,0),(-1,-1),.7,colors.HexColor("#E4B74F")),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8)])), p("5. Checklist trước khi Submit hoặc Complete", "H1VN"), p("□ Tên section mô tả đúng dữ liệu và nhất quán với các task khác."), p("□ Giá trị được lấy đúng từ tài liệu, không bỏ đơn vị hoặc dấu âm."), p("□ Source page đúng; bbox không che sang vùng dữ liệu khác."), p("□ Các section khác nhau trong review case đều có giá trị cuối cùng."), p("□ Chỉ bấm Complete khi kết quả có thể dùng làm dữ liệu chuẩn."), Spacer(1, 6 * mm), p("Tài liệu mẫu - có thể thay thế bằng bản nghiệp vụ chính thức tại cùng đường dẫn mà không cần sửa giao diện.", "CenterVN")]

doc.build(story)
print(OUTPUT)
