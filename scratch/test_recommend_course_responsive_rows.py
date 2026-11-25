import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\rdiva\.gemini\antigravity\brain\78e04755-da2d-4ff2-be2d-76170b516d55"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1536, "height": 864})
        page = context.new_page()

        page.add_init_script('''
            localStorage.setItem("lms_token", "dev-token-EMP004");
            localStorage.setItem("lms_user", JSON.stringify({
                id: 4,
                employee_id: "EMP004",
                name: "Suresh Menon",
                email: "suresh@emergere.com",
                role: "reporting_manager",
                is_profile_completed: true
            }));
            localStorage.setItem("lms_primary_role", "reporting_manager");
            localStorage.setItem("lms_current_mode", "PRIMARY");
            localStorage.setItem("lms_profile_completed", "true");
            localStorage.setItem("lms_active_employee_id", "EMP004");
        ''')

        print("=== Test 1: 100% Zoom (1536 x 864) ===")
        page.goto("http://localhost:3000/reporting-manager/recommend-course")
        page.wait_for_selector(".emp-course-card", timeout=15000)
        time.sleep(1)

        card_count_100 = page.locator(".rm-recommend-course-grid .emp-course-card").count()
        pag_text_100 = page.locator(".emp-pagination-text").inner_text()
        print(f"100% Zoom: Card count = {card_count_100}, Pagination text = '{pag_text_100}'")
        assert card_count_100 == 12, f"Expected 12 cards (3 rows) at 100% zoom, got {card_count_100}"
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_100_percent_3rows.png"))

        # Test 2: 110% Zoom (1396 x 785)
        print("\n=== Test 2: 110% Zoom (1396 x 785) ===")
        page.set_viewport_size({"width": 1396, "height": 785})
        time.sleep(1)

        card_count_110 = page.locator(".rm-recommend-course-grid .emp-course-card").count()
        pag_text_110 = page.locator(".emp-pagination-text").inner_text()
        print(f"110% Zoom: Card count = {card_count_110}, Pagination text = '{pag_text_110}'")
        assert card_count_110 == 12, f"Expected 12 cards (3 rows) at 110% zoom, got {card_count_110}"
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_110_percent_3rows.png"))

        # Test 3: 125% Zoom / Short Viewport (1228 x 650)
        print("\n=== Test 3: 125% Zoom (1228 x 650) ===")
        page.set_viewport_size({"width": 1228, "height": 650})
        time.sleep(1)

        card_count_125 = page.locator(".rm-recommend-course-grid .emp-course-card").count()
        pag_text_125 = page.locator(".emp-pagination-text").inner_text()
        print(f"125% Zoom: Card count = {card_count_125}, Pagination text = '{pag_text_125}'")
        assert card_count_125 == 8, f"Expected 8 cards (2 rows) at 125% zoom, got {card_count_125}"
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_125_percent_2rows.png"))

        # Test 4: Tall Screen / 75-80% Zoom (1536 x 1000)
        print("\n=== Test 4: Tall Screen (1536 x 1000) ===")
        page.set_viewport_size({"width": 1536, "height": 1000})
        time.sleep(1)

        card_count_tall = page.locator(".rm-recommend-course-grid .emp-course-card").count()
        pag_text_tall = page.locator(".emp-pagination-text").inner_text()
        print(f"Tall Screen: Card count = {card_count_tall}, Pagination text = '{pag_text_tall}'")
        assert card_count_tall == 16, f"Expected 16 cards (4 rows) on tall screen, got {card_count_tall}"
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_tall_4rows.png"))

        print("\n=======================================================")
        print("ALL RESPONSIVE COURSE CARD ROW TESTS PASSED PERFECTLY!")
        print("=======================================================")
        browser.close()

if __name__ == "__main__":
    run_test()
