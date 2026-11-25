import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        page = b.new_page(viewport={"width": 1396, "height": 785})
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
        page.goto("http://localhost:3000/reporting-manager/recommend-course")
        page.wait_for_selector(".emp-pagination-text", timeout=25000)
        print("Courses finished loading!")
        print("Card count:", page.locator(".emp-course-card:not([style*='opacity'])").count())
        print("Pagination text:", page.locator(".emp-pagination-text").inner_text())
        b.close()

if __name__ == "__main__":
    run()
