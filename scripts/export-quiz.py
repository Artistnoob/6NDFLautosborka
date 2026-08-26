from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BANK_DIR = ROOT / "src" / "lib" / "quiz"
OUT = ROOT / "вопросы-квиза.txt"

SECTIONS = [
    ("ndfl-reports", "6-НДФЛ, 2-НДФЛ"),
    ("sick", "БЛ, электронный БЛ, пособия"),
    ("buh", "Бухучет ЗП, обмен с БГУ"),
    ("payments", "Выплаты, долги"),
    ("kadry", "Кадры"),
    ("ndfl", "НДФЛ"),
    ("vacation", "Отпуск, средний заработок"),
    ("other", "Прочие вопросы по учету"),
    ("payroll", "Расчет зарплаты"),
    ("rsv", "РСВ, перс. сведения, ЕФС-1 р.2"),
    ("szv", "СЗВ, ЕФС-1 раздел 1"),
    ("stats", "Статистика (П-4, ЗП-здрав)"),
    ("deductions", "Удержания, взносы"),
]
TITLES = dict(SECTIONS)

STRING_RE = re.compile(r"'((?:\\'|[^'])*)'")


def parse_questions():
    items = []
    for name in ["bankPart1.ts", "bankPart2.ts", "bankPart3.ts", "bankPart4.ts"]:
        text = (BANK_DIR / name).read_text(encoding="utf-8")
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped.startswith("q("):
                continue
            args = STRING_RE.findall(stripped)
            if len(args) != 7:
                raise SystemExit(f"Bad q() in {name}: {stripped[:120]} ({len(args)} args)")
            section, qid, question, a, b, c, d = args
            items.append(
                {
                    "section": section,
                    "id": f"{section}-{qid}",
                    "question": question.replace("\\'", "'"),
                    "options": [a, b, c, d],
                }
            )
    return items


def main():
    questions = parse_questions()
    lines = [
        "Контракты Найт-Сити — банк вопросов",
        f"Всего вопросов: {len(questions)}",
        "Правильный ответ отмечен как [верно]. В игре варианты перемешиваются.",
        "",
    ]
    by_section = {sid: [] for sid, _ in SECTIONS}
    unknown = []
    for item in questions:
        if item["section"] in by_section:
            by_section[item["section"]].append(item)
        else:
            unknown.append(item)

    n = 0
    for sid, title in SECTIONS:
        group = by_section[sid]
        lines.append("=" * 72)
        lines.append(f"{title}  ({len(group)})")
        lines.append("=" * 72)
        lines.append("")
        for item in group:
            n += 1
            lines.append(f"{n}. {item['question']}")
            lines.append(f"    id: {item['id']}")
            for i, option in enumerate(item["options"]):
                mark = " [верно]" if i == 0 else ""
                lines.append(f"    {chr(65 + i)}) {option}{mark}")
            lines.append("")

    if unknown:
        raise SystemExit(f"Unknown sections: {unknown[:3]}")

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {n} questions to {OUT}")


if __name__ == "__main__":
    main()
