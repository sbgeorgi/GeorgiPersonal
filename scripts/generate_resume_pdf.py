"""Generate the one-page resume used by the portfolio download link."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "georgi-chertkov-resume.pdf"
SITE_COPY = ROOT / "assets" / "georgi-chertkov-resume.pdf"

INK = HexColor("#171914")
BODY = HexColor("#34372F")
MUTED = HexColor("#5A5E54")
ACCENT = HexColor("#87AA22")
RULE = HexColor("#D8DCCF")
PANEL = HexColor("#F5F7F0")


def wrap(text, font, size, width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font, size) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, width, font="Helvetica", size=8.4, leading=10.4, color=BODY):
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(text, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def section_title(c, text, x, y, width):
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x, y, text.upper())
    c.setStrokeColor(RULE)
    c.setLineWidth(0.7)
    c.line(x, y - 4, x + width, y - 4)
    return y - 16


def bullet(c, text, x, y, width):
    c.setFillColor(ACCENT)
    c.circle(x + 2.2, y + 2.5, 1.35, fill=1, stroke=0)
    return draw_wrapped(c, text, x + 10, y, width - 10, size=7.75, leading=9.3)


def role(c, x, y, width, title, organization, dates, bullets):
    title_size = 8.9
    date_size = 6.8
    date_width = stringWidth(dates.upper(), "Helvetica-Bold", date_size)
    title_width = width - date_width - 14
    title_lines = wrap(title, "Helvetica-Bold", title_size, title_width)

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", title_size)
    title_y = y
    for line in title_lines:
        c.drawString(x, title_y, line)
        title_y -= 10.2

    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", date_size)
    c.drawRightString(x + width, y + 0.5, dates.upper())

    y = title_y - 0.5
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 6.9)
    c.drawString(x, y, organization.upper())
    y -= 10.2
    for item in bullets:
        y = bullet(c, item, x, y, width)
        y -= 1.7
    return y - 4.2


def sidebar_list(c, items, x, y, width):
    for item in items:
        c.setFillColor(ACCENT)
        c.circle(x + 2.2, y + 2.5, 1.25, fill=1, stroke=0)
        y = draw_wrapped(c, item, x + 9, y, width - 9, size=7.5, leading=9.2)
        y -= 2.2
    return y


def impact_box(c, x, y, width, number, label):
    height = 38
    c.setFillColor(PANEL)
    c.setStrokeColor(RULE)
    c.roundRect(x, y - height, width, height, 4, fill=1, stroke=1)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x + 7, y - 17, number)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 5.8)
    label_y = y - 26
    for line in wrap(label.upper(), "Helvetica-Bold", 5.8, width - 14):
        c.drawString(x + 7, label_y, line)
        label_y -= 6.5


def build(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(path), pagesize=letter, pageCompression=1)
    width, height = letter
    c.setTitle("Georgi Chertkov - Resume")
    c.setAuthor("Georgi Chertkov")
    c.setSubject("Founder of OffsetMap and NomadSwipe, environmental scientist, agriculture and carbon markets")

    left = 36
    right = width - 36
    y = height - 36

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 25)
    c.drawString(left, y, "GEORGI CHERTKOV")
    y -= 22
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(left, y, "FOUNDER / ENVIRONMENTAL SCIENTIST / AGRICULTURE & CARBON MARKETS")
    y -= 15
    summary = (
        "Environmental scientist and agricultural specialist with a strong background in policy and economic "
        "analysis. Founder of OffsetMap and NomadSwipe, combining climate and carbon-market knowledge with applied "
        "research, data visualization, React Native and web development."
    )
    y = draw_wrapped(c, summary, left, y, right - left, size=8.6, leading=10.5, color=BODY)
    y -= 2
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.2)
    c.drawString(left, y, "georgichertkov@gmail.com")
    c.drawString(left + 142, y, "linkedin.com/in/georgichertkov")
    c.drawString(left + 326, y, "offsetmap.com")
    c.drawRightString(right, y, "Tucson, AZ / Remote")
    y -= 10
    c.setStrokeColor(ACCENT)
    c.setLineWidth(2.2)
    c.line(left, y, right, y)
    top = y - 18

    left_width = 350
    gap = 24
    side_x = left + left_width + gap
    side_width = right - side_x

    left_y = section_title(c, "Experience", left, top, left_width)
    left_y = role(
        c, left, left_y, left_width,
        "Founder & Full-stack Developer", "NomadSwipe / Remote / React Native", "Sep 2025 - Present",
        [
            "Own the full product: strategy, design, mobile app, backend, recommendation logic, maps, releases and maintenance.",
        ],
    )
    left_y = role(
        c, left, left_y, left_width,
        "Founder", "OffsetMap / Self-employed / Remote", "Mar 2023 - Present",
        [
            "Lead product development, maintenance and strategy for a carbon-offset data web application.",
            "Manage complex datasets, evolving standards, registry information and credit-retirement data.",
            "Build with Python, JavaScript and SQL; create maps and visualizations and work with stakeholders.",
        ],
    )
    left_y = role(
        c, left, left_y, left_width,
        "Environmental Scientist / Biostatistician II", "Biosphere 2 / University of Arizona", "Mar 2024 - Jun 2026",
        [
            "Designed and managed carbon-market research and assessed carbon-methodology testing opportunities.",
            "Built avsinfronteras.org and salsav.org with interactive maps, graphs, networking and research tools.",
            "Translated technical information for researchers and stakeholders and contributed to academic work.",
        ],
    )
    left_y = role(
        c, left, left_y, left_width,
        "Expert", "Higher School of Economics / Moscow", "Sep 2020 - May 2022",
        [
            "Produced policy reports on emissions markets, carbon pricing, carbon farming, agriculture and transport.",
            "Analyzed agricultural firms and ag-tech startups and provided applied research for policymakers.",
        ],
    )
    left_y = role(
        c, left, left_y, left_width,
        "Future Policy Award Intern", "World Future Council / Hamburg", "May 2019 - Sep 2019",
        [
            "Researched and co-wrote 12 of 26 policies evaluated with IPU and UNDP.",
            "Interviewed experts and co-authored work on agroecology and digitization.",
        ],
    )
    left_y = role(
        c, left, left_y, left_width,
        "Masters Student", "WorldFish / Myanmar", "Feb 2019 - Sep 2019",
        [
            "Surveyed 39 aquaculture farmers and informants; coordinated multi-partner fieldwork.",
            "Performed financial, cost-benefit and investment analyses using household data.",
        ],
    )

    side_y = section_title(c, "Core Expertise", side_x, top, side_width)
    side_y = draw_wrapped(
        c,
        "Carbon markets / Carbon pricing / Agrivoltaics / Carbon farming / Regenerative agriculture / Agroecology / Climate science",
        side_x, side_y, side_width, size=7.6, leading=9.4,
    ) - 11

    side_y = section_title(c, "Research & Analysis", side_x, side_y, side_width)
    side_y = sidebar_list(c, [
        "Policy and market analysis",
        "Cost-benefit and investment analysis",
        "Survey and field research",
        "Project design and management",
        "Scientific and stakeholder communication",
    ], side_x, side_y, side_width) - 8

    side_y = section_title(c, "Technical", side_x, side_y, side_width)
    side_y = draw_wrapped(
        c,
        "React Native / Python / JavaScript / SQL / Flask / Leaflet / Plotly / Dash / Chart.js / Interactive maps / Data visualization",
        side_x, side_y, side_width, size=7.6, leading=9.4,
    ) - 11

    side_y = section_title(c, "Education", side_x, side_y, side_width)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 7.8)
    side_y = draw_wrapped(c, "M.Sc., Environmental Protection & Agricultural Food Production", side_x, side_y, side_width, font="Helvetica-Bold", size=7.8, leading=9.4, color=INK)
    side_y -= 2
    side_y = draw_wrapped(c, "University of Hohenheim, 2019", side_x, side_y, side_width, size=7.2, leading=8.8, color=MUTED)
    side_y -= 5
    side_y = draw_wrapped(c, "B.S., Earth Science (Earth Systems)", side_x, side_y, side_width, font="Helvetica-Bold", size=7.5, leading=8.9, color=INK)
    side_y = draw_wrapped(c, "B.S., Environmental Studies", side_x, side_y, side_width, font="Helvetica-Bold", size=7.5, leading=8.9, color=INK)
    side_y = draw_wrapped(c, "UC Santa Barbara, 2007 - 2012", side_x, side_y, side_width, size=7.2, leading=8.8, color=MUTED)
    side_y -= 5
    side_y = draw_wrapped(c, "Thesis research with WorldFish on smallholder aquaculture productivity in Myanmar.", side_x, side_y, side_width, size=7.2, leading=8.8, color=BODY) - 10

    side_y = section_title(c, "Selected Impact", side_x, side_y, side_width)
    box_gap = 6
    box_width = (side_width - box_gap) / 2
    impact_box(c, side_x, side_y, box_width, "3+", "Years leading OffsetMap")
    impact_box(c, side_x + box_width + box_gap, side_y, box_width, "2+", "Years at Biosphere 2")
    side_y -= 44
    impact_box(c, side_x, side_y, box_width, "12", "Award policies researched")
    impact_box(c, side_x + box_width + box_gap, side_y, box_width, "39", "Farmers surveyed")

    if left_y < 30 or side_y - 40 < 30:
        raise RuntimeError(f"Resume overflow: left={left_y:.1f}, right={side_y - 40:.1f}")

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.2)
    c.drawRightString(right, 20, "Updated July 2026")
    c.showPage()
    c.save()


if __name__ == "__main__":
    build(OUTPUT)
    SITE_COPY.parent.mkdir(parents=True, exist_ok=True)
    SITE_COPY.write_bytes(OUTPUT.read_bytes())
    print(OUTPUT)
    print(SITE_COPY)
