import sys
import json
import time
from playwright.sync_api import sync_playwright

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
BASE_URL = "http://127.0.0.1:5173"

def run_browser_tests():
    print("[UAT Browser] Starting Chromium via Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True
        )
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        # Step 3: Confirm exactly 7 Sunday/anticipated and 7 weekday columns on Regular Publication
        print("[UAT Browser] Navigating to Regular Publication public schedule...")
        page.goto(f"{BASE_URL}/public/schedule/pub-uat-novdec2026", wait_until="domcontentloaded")
        page.wait_for_selector("table", timeout=15000)

        # Inspect table headers
        tables = page.query_selector_all("table")
        print(f"[UAT Browser] Found {len(tables)} table(s)")
        assert len(tables) >= 2, f"Expected at least 2 tables (Sunday and Weekday), found {len(tables)}"

        # Sunday table headers (exclude ROLE column header)
        sunday_headers = tables[0].query_selector_all("thead tr th")
        sunday_cols = [th.inner_text().strip() for th in sunday_headers if "ROLE" not in th.inner_text()]
        print(f"[UAT Browser] Sunday/Anticipated Columns ({len(sunday_cols)}): {sunday_cols}")
        assert len(sunday_cols) == 7, f"Expected 7 Sunday/Anticipated columns, got {len(sunday_cols)}"

        # Weekday table headers
        weekday_headers = tables[1].query_selector_all("thead tr th")
        weekday_cols = [th.inner_text().strip() for th in weekday_headers if "ROLE" not in th.inner_text()]
        print(f"[UAT Browser] Weekday Columns ({len(weekday_cols)}): {weekday_cols}")
        assert len(weekday_cols) == 7, f"Expected 7 Weekday columns, got {len(weekday_cols)}"

        # Confirm no repeated calendar dates in columns (headers should be pattern days)
        for col in sunday_cols:
            assert "SATURDAY" in col.upper() or "SUNDAY" in col.upper(), f"Unexpected Sunday col: {col}"
        for col in weekday_cols:
            assert any(day in col.upper() for day in ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]), f"Unexpected Weekday col: {col}"

        # Step 5: Verify Special Event public link displays only its own schedules
        print("[UAT Browser] Navigating to Special Event public schedule...")
        page.goto(f"{BASE_URL}/public/schedule/pub-uat-special2026", wait_until="domcontentloaded")
        page.wait_for_selector("table", timeout=15000)

        special_tables = page.query_selector_all("table")
        special_headers = special_tables[0].query_selector_all("thead tr th")
        special_cols = [th.inner_text().strip() for th in special_headers if "ROLE" not in th.inner_text()]
        print(f"[UAT Browser] Special Event Columns ({len(special_cols)}): {special_cols}")
        assert len(special_cols) == 2, f"Expected exactly 2 special event columns, got {len(special_cols)}"

        # Confirm Regular Sunday and Weekday Mass columns do NOT leak into special publication
        page_text = page.inner_text("body")
        assert "Sunday 6:00 AM" not in page_text, "Leakage: Regular Mass found in special publication"
        assert "Monday 6:00 AM" not in page_text, "Leakage: Regular Mass found in special publication"

        # Step 6: Submit a member's recurring Mass selections on Regular publication
        print("[UAT Browser] Returning to Regular publication to submit member selection...")
        page.goto(f"{BASE_URL}/public/schedule/pub-uat-novdec2026", wait_until="domcontentloaded")
        page.wait_for_selector("table", timeout=15000)

        # Select member from picker
        member_btn = page.query_selector("button:has-text('Click to search / select your name')")
        assert member_btn is not None, "Member picker trigger button not found"
        member_btn.click()
        page.wait_for_selector("input[type='text']", timeout=5000)

        # Search for Juan Dela Cruz
        search_input = page.query_selector("input[type='text']")
        search_input.fill("Dela Cruz")
        time.sleep(0.5)

        # Click member option div
        page.locator("div.cursor-pointer", has_text="Dela Cruz, Juan").first.click()
        time.sleep(0.8)

        # Ensure any notice modal is dismissed
        notice_btn = page.query_selector("button:has-text('Got it')")
        if notice_btn and notice_btn.is_visible():
            notice_btn.click()
            time.sleep(0.5)

        # Click an empty slot in the table (dashed cell)
        empty_cells = page.query_selector_all("td div.border-dashed")
        print(f"[UAT Browser] Found {len(empty_cells)} open slot cells")
        assert len(empty_cells) > 0, "No open slot cells found in table"
        empty_cells[0].click()
        time.sleep(0.8)

        # Dismiss notice modal if limit warning popped up
        notice_btn = page.query_selector("button:has-text('Got it')")
        if notice_btn and notice_btn.is_visible():
            notice_btn.click()
            time.sleep(0.5)

        # Submit button
        submit_btn = page.locator("button", has_text="Submit").first
        assert submit_btn.is_visible(), "Submit button not visible"
        print(f"[UAT Browser] Submit button status: enabled={submit_btn.is_enabled()}")
        if submit_btn.is_enabled():
            submit_btn.click()
            time.sleep(0.8)
            # Confirm modal if present
            modal_confirm = page.query_selector("button:has-text('Submit Preferences')")
            if modal_confirm and modal_confirm.is_visible():
                modal_confirm.click()
                time.sleep(2)

        print("[UAT Browser] All browser validation steps completed successfully!")
        browser.close()

if __name__ == "__main__":
    try:
        run_browser_tests()
        sys.exit(0)
    except Exception as e:
        print(f"[UAT Browser ERROR] {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
