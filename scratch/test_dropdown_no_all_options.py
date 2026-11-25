import os
import time
from playwright.sync_api import sync_playwright

artifact_dir = r"C:\Users\rdiva\.gemini\antigravity\brain\78e04755-da2d-4ff2-be2d-76170b516d55"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Set up Reporting Manager user in localStorage
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

        print("=== 1. Checking Learning Records Dropdowns ===")
        page.goto("http://localhost:3000/reporting-manager/learning-records")
        page.wait_for_selector(".rm-btn-filter-action", timeout=15000)
        time.sleep(1)

        # Open Filter Drawer
        page.locator(".rm-btn-filter-action").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")

        # Click Department dropdown trigger
        dept_group = page.locator(".emp-drawer-dropdown-group:has-text('Department')")
        dept_trigger = dept_group.locator(".emp-drawer-dropdown-trigger")
        dept_trigger.click()
        time.sleep(0.5)

        # Inspect options in dropdown list
        items = dept_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Department dropdown items:", items)
        assert not any("All Department" in it for it in items), f"Found 'All Departments' inside list: {items}"
        print("PASS: 'All Departments' is NOT inside Department dropdown list.")

        # Capture screenshot with Department dropdown open
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_learning_records_dept_dropdown.png"))

        # Close Department dropdown by pressing Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)

        # Open Course dropdown
        course_group = page.locator(".emp-drawer-dropdown-group:has-text('Course')")
        course_trigger = course_group.locator(".emp-drawer-dropdown-trigger")
        course_trigger.click()
        time.sleep(0.5)

        course_items = course_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Course dropdown items:", course_items)
        assert not any("All Course" in it for it in course_items), f"Found 'All Courses' inside list: {course_items}"
        print("PASS: 'All Courses' is NOT inside Course dropdown list.")

        # Close Course dropdown
        page.keyboard.press("Escape")
        time.sleep(0.5)

        # Switch to Certification tab
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        page.locator("button.rm-pill-tab-btn:has-text('Certification')").click()
        time.sleep(1)

        page.locator(".rm-btn-filter-action").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")

        # Check Provider dropdown
        prov_group = page.locator(".emp-drawer-dropdown-group:has-text('Provider')")
        prov_trigger = prov_group.locator(".emp-drawer-dropdown-trigger")
        prov_trigger.click()
        time.sleep(0.5)

        prov_items = prov_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Provider dropdown items:", prov_items)
        assert not any("All Provider" in it for it in prov_items), f"Found 'All Providers' inside list: {prov_items}"
        print("PASS: 'All Providers' is NOT inside Provider dropdown list.")

        # Close dropdown
        page.keyboard.press("Escape")
        time.sleep(0.5)

        page.locator(".rm-filter-panel-close-btn").click()

        print("\n=== 2. Checking Recommend Course Page Dropdowns ===")
        page.goto("http://localhost:3000/reporting-manager/recommend-course")
        page.wait_for_selector(".rm-btn-filter-toggle", timeout=15000)
        time.sleep(1)

        # Open Filter Drawer
        page.locator(".rm-btn-filter-toggle").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")

        # Verify Category is a dropdown
        cat_group = page.locator(".emp-drawer-dropdown-group:has-text('Category')")
        assert cat_group.is_visible(), "Category must be a dropdown group!"
        cat_trigger = cat_group.locator(".emp-drawer-dropdown-trigger")
        cat_trigger.click()
        time.sleep(0.5)

        cat_items = cat_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Recommend Course Category items:", cat_items)
        assert not any("All Categor" in it for it in cat_items), f"Found 'All Categories' inside list: {cat_items}"
        print("PASS: 'All Categories' is NOT inside Category dropdown list.")

        # Close Category dropdown before opening Platform dropdown
        page.keyboard.press("Escape")
        time.sleep(0.5)

        # Verify Platform is a dropdown
        plat_group = page.locator(".emp-drawer-dropdown-group:has-text('Platform')")
        assert plat_group.is_visible(), "Platform must be a dropdown group!"
        plat_trigger = plat_group.locator(".emp-drawer-dropdown-trigger")
        plat_trigger.click()
        time.sleep(0.5)

        plat_items = plat_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Recommend Course Platform items:", plat_items)
        assert not any("All Platform" in it for it in plat_items), f"Found 'All Platforms' inside list: {plat_items}"
        print("PASS: 'All Platforms' is NOT inside Platform dropdown list.")

        # Capture screenshot of open dropdowns in Recommend Course
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_course_dropdowns.png"))

        # Close Platform dropdown
        page.keyboard.press("Escape")
        time.sleep(0.5)

        # Switch to Resources tab
        page.locator(".rm-filter-panel-close-btn").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="hidden")
        page.locator("button.rm-tab-pill:has-text('Resources')").click()
        time.sleep(1)

        page.locator(".rm-btn-filter-toggle").click()
        page.wait_for_selector(".rm-filter-drawer-panel", state="visible")

        # Verify Category dropdown in Resources tab
        res_cat_group = page.locator(".emp-drawer-dropdown-group:has-text('Category')")
        assert res_cat_group.is_visible(), "Category must be a dropdown group in Resources tab!"
        res_cat_trigger = res_cat_group.locator(".emp-drawer-dropdown-trigger")
        res_cat_trigger.click()
        time.sleep(0.5)

        res_cat_items = res_cat_group.locator(".emp-drawer-dropdown-item-label").all_inner_texts()
        print("Resources Category items:", res_cat_items)
        assert not any("All Categor" in it for it in res_cat_items), f"Found 'All Categories' inside list: {res_cat_items}"
        print("PASS: 'All Categories' is NOT inside Resources Category dropdown list.")

        # Capture screenshot of Resources tab filter drawer
        page.screenshot(path=os.path.join(artifact_dir, "verified_rm_recommend_resource_dropdowns.png"))

        print("\n=======================================================")
        print("ALL DROPDOWN VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("=======================================================")
        browser.close()

if __name__ == "__main__":
    run_test()
