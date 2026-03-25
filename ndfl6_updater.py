import os
import xml.etree.ElementTree as ET
from tkinter import Tk
from tkinter.filedialog import askopenfilenames


def _parse_float(value: str) -> float:
    try:
        return float(value.replace(',', '.'))
    except:
        return 0.0


def update_report(report, from_notif, s1_map, s2_map):
    for node in report.iter():
        tag_name = node.tag.split('}')[-1]

        # === РАЗДЕЛ 1 (ОбязНА) ===
        if tag_name == "ОбязНА":
            kbk = node.get("КБК")
            sved = node.find("{*}СведСумНалУд")
            if sved is not None:
                # Обнуляем все сроки
                for attr in s1_map.values():
                    sved.set(attr, "0")

                if kbk in from_notif:
                    for slot, attr in s1_map.items():
                        if slot in from_notif[kbk]:
                            sved.set(attr, str(from_notif[kbk][slot]))

                # Пересчёт СумНалУд
                total_160_s1 = sum(int(sved.get(a) or "0") for a in s1_map.values())
                node.set("СумНалУд", str(total_160_s1))

        # === РАЗДЕЛ 2 (РасчСумНал) ===
        if tag_name == "РасчСумНал":
            kbk = node.get("КБК")
            stavka_val = _parse_float(node.get("Ставка") or "13")
            stavka = stavka_val / 100

            # 1. Полностью очищаем нежелательные атрибуты
            cleaned_attrs = {}
            for k, v in node.attrib.items():
                if any(x in k for x in ["НеУдерж", "ИзлУдерж", "СумНалУдерж1Мес", "СумНалУдерж23"]):
                    continue
                cleaned_attrs[k] = v

            node.attrib = cleaned_attrs

            # 2. Принудительно ставим 0 в 170 и 180 (на всякий случай)
            node.set("СумНалНеУдерж", "0")
            node.set("СумНалИзлУдерж", "0")

            # 3. Обнуляем все поля удержанного налога по срокам
            for attr in s2_map.values():
                node.set(attr, "0")

            # 4. Заполняем из уведомлений
            if kbk in from_notif:
                for slot, attr in s2_map.items():
                    if slot in from_notif[kbk]:
                        node.set(attr, str(from_notif[kbk][slot]))

            # 5. Пересчёт итогов
            sum_160 = sum(int(node.get(a) or "0") for a in s2_map.values())
            node.set("СумНалУдерж", str(sum_160))
            node.set("СумНалИсч", str(sum_160))

            sum_131 = round(sum_160 / stavka, 2) if stavka > 0 and sum_160 != 0 else 0.00
            node.set("НалБаза", f"{sum_131:.2f}")

            sum_130 = _parse_float(node.get("СумВыч") or "0")
            node.set("СумНачислНач", f"{round(sum_131 + sum_130, 2):.2f}")


def main():
    root = Tk()
    root.withdraw()

    rep_paths = askopenfilenames(title="Выберите файлы отчёта 6-НДФЛ",
                                 filetypes=[("XML файлы", "*.xml")])
    not_paths = askopenfilenames(title="Выберите файлы Уведомлений",
                                 filetypes=[("XML файлы", "*.xml")])

    if not rep_paths or not not_paths:
        print("Не выбраны файлы.")
        return

    # Загружаем все уведомления
    notifs = []
    for p in not_paths:
        try:
            notifs.append(ET.parse(p).getroot())
        except Exception as e:
            print(f"Не удалось прочитать уведомление {p}: {e}")

    s1_map = {
        "01": "СумНал1Срок", "11": "СумНал2Срок", "02": "СумНал3Срок",
        "12": "СумНал4Срок", "03": "СумНал5Срок", "13": "СумНал6Срок"
    }
    s2_map = {
        "01": "СумНалУдерж1Мес", "11": "СумНалУдерж23_1Мес",
        "02": "СумНалУдерж2Мес", "12": "СумНалУдерж23_2Мес",
        "03": "СумНалУдерж3Мес", "13": "СумНалУдерж23_3Мес"
    }

    for p in rep_paths:
        try:
            tree = ET.parse(p)
            root_xml = tree.getroot()

            # Получаем реквизиты отчёта
            np = root_xml.find(".//{*}НПЮЛ")
            inn = np.get("ИННЮЛ") if np is not None else None
            kpp = np.get("КПП") if np is not None else None

            svnp = root_xml.find(".//{*}СвНП")
            oktmo = svnp.get("ОКТМО") if svnp is not None else None

            doc = root_xml.find(".//{*}Документ")
            per = doc.get("Период") if doc is not None else None
            yr = doc.get("ОтчетГод") if doc is not None else None

            # Собираем данные из уведомлений
            from_notif = {}
            for n in notifs:
                n_np = n.find(".//{*}НПЮЛ")
                if n_np is not None and n_np.get("ИННЮЛ") == inn:
                    for u in n.findall(".//{*}УвИсчСумНалог"):
                        if (u.get("КППДекл") == kpp and
                                u.get("ОКТМО") == oktmo and
                                u.get("Период") == per and
                                u.get("Год") == yr):
                            kbk = u.get("КБК")
                            slot = u.get("НомерМесКварт")
                            summ = int(u.get("СумНалогАванс") or "0")

                            from_notif.setdefault(kbk, {})
                            from_notif[kbk][slot] = from_notif[kbk].get(slot, 0) + summ

            # Основная обработка
            update_report(root_xml, from_notif, s1_map, s2_map)

            # ==================== ГАРАНТИРОВАННОЕ ОБНУЛЕНИЕ 170 и 180 ====================
            # Проходим по ВСЕМ РасчСумНал в самом конце и принудительно ставим 0
            for node in root_xml.iter():
                if node.tag.split('}')[-1] == "РасчСумНал":
                    node.set("СумНалНеУдерж", "0")
                    node.set("СумНалИзлУдерж", "0")
            # =============================================================================

            # Сохранение
            out_path = os.path.join(os.path.dirname(p), f"fixed_{os.path.basename(p)}")
            tree.write(out_path, encoding="windows-1251", xml_declaration=True)
            print(f"Готово: {out_path}")

        except Exception as e:
            print(f"Ошибка при обработке {p}: {e}")


if __name__ == "__main__":
    main()