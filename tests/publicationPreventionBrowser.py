"""Local emulator-only checks. Start tests/browser/publication.vite.config.mjs first."""
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

BASE_URL = 'http://127.0.0.1:5174/tests/browser/publication.html'
ARTIFACTS = Path('.firebase/publication-verification')


def historical_snapshot():
    # The emulator-only owner token never leaves localhost or this demo project.
    records = ['schedules/browser-row-000', 'schedules/browser-row-099', 'schedules/browser-row-100', 'schedules/browser-row-103', 'schedules/browser-row-104', 'attendance/browser-history', 'attendanceSessions/browser-history', 'scheduleSubmissions/browser-history', 'schedulePublications/browser-regular', 'schedulePublications/browser-special']
    snapshot = {}
    for record in records:
        url = f'http://127.0.0.1:8080/v1/projects/demo-mats-publication-browser/databases/(default)/documents/{record}'
        with urlopen(Request(url, headers={'Authorization': 'Bearer owner'}), timeout=10) as response:
            snapshot[record] = json.load(response)
    return snapshot


def run():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    before = historical_snapshot()
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for name, viewport in [('desktop', {'width': 1280, 'height': 900}), ('mobile', {'width': 390, 'height': 844})]:
            context = browser.new_context(viewport=viewport, is_mobile=name == 'mobile', has_touch=name == 'mobile')
            context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).hostname in ('127.0.0.1', 'localhost') else route.abort())
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE_URL, wait_until='domcontentloaded')
            expect(page.locator(':text-is("Browser Regular Cycle"):visible').first).to_be_visible(timeout=60000)
            assert page.evaluate('window.publicationVerification.projectId') == 'demo-mats-publication-browser'
            page.get_by_role('button', name='Review duplicate schedules', exact=True).click()
            dialog = page.get_by_role('dialog', name='')
            expect(page.get_by_text('Review Duplicate Schedules', exact=True)).to_be_visible()
            assert page.evaluate('window.publicationVerification.reportReads.length') == 0
            page.get_by_role('button', name='Run Preview', exact=True).click()
            expect(page.get_by_text('100 schedules reviewed;', exact=False)).to_be_visible(timeout=15000)
            expect(page.get_by_text('Preview is incomplete.', exact=False)).to_be_visible()
            page.get_by_role('button', name='Load Next 100 Schedules', exact=True).click()
            expect(page.get_by_text('105 schedules reviewed;', exact=False)).to_be_visible(timeout=15000)
            expect(page.get_by_text('Schedule: browser-row-099', exact=True)).to_be_visible()
            expect(page.get_by_text('Schedule: browser-row-100', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Load Next 100 Schedules', exact=True)).to_have_count(0)
            assert page.evaluate('window.publicationVerification.reportReads') == [100, 5]
            page.wait_for_timeout(350)
            assert page.evaluate('window.publicationVerification.reportReads') == [100, 5], 'Unexpected polling/read after report completion'
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Horizontal viewport overflow'
            modal_bounds = dialog.bounding_box()
            assert modal_bounds and modal_bounds['width'] <= viewport['width']
            page.screenshot(path=str(ARTIFACTS / f'duplicate-report-{name}.png'), full_page=True)

            # Offline errors must retain a useful UI and recover without a reload.
            context.set_offline(True)
            page.get_by_role('button', name='Run Preview', exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Connect to the internet')
            assert page.evaluate('window.publicationVerification.reportReads') == [100, 5]
            context.set_offline(False)
            page.get_by_role('button', name='Run Preview', exact=True).click()
            expect(page.get_by_text('100 schedules reviewed;', exact=False)).to_be_visible(timeout=15000)

            # Invalid date ranges fail without another Firestore query.
            page.locator('#duplicate-start').click()
            page.get_by_title('Next Month', exact=True).click()
            next_month = page.evaluate('''() => {
              const [year, month] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date()).split('-').map(Number);
              return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
            }''')
            page.locator(f'[data-calendar-day][aria-label="{next_month}"]').click()
            page.get_by_role('button', name='Run Preview', exact=True).click()
            expect(page.get_by_role('alert')).to_contain_text('Select a valid start and end date')
            assert page.evaluate('window.publicationVerification.reportReads') == [100, 5, 100]
            page.keyboard.press('Escape')
            expect(page.get_by_text('Review Duplicate Schedules', exact=True)).to_have_count(0)

            # Exercise the real publication form's overlap error and recovery.
            page.get_by_role('button', name='+ Create Publication', exact=True).click()
            page.locator('#pub-form input[type="text"]').first.fill('Unintended overlapping regular cycle')
            page.get_by_role('button', name='Save Publication', exact=True).click()
            expect(page.get_by_text('Regular publication overlaps', exact=False)).to_be_visible(timeout=15000)
            expect(page.get_by_role('button', name='Save Publication', exact=True)).to_be_enabled()
            page.screenshot(path=str(ARTIFACTS / f'publication-overlap-{name}.png'), full_page=True)
            page.get_by_role('button', name='Cancel', exact=True).click()
            assert not errors, errors
            results.append({'viewport': name, 'checks': ['cursor pagination', 'cross-page duplicates', 'no automatic reads', 'offline/recovery', 'invalid dates', 'overlap form', 'no horizontal overflow'], 'page_errors': errors})

            if name == 'desktop':
                generation = page.evaluate('''async () => {
                  const service = window.publicationVerification.recurringService;
                  const template = { id: 'browser-wed', name: 'Wednesday', title: 'Wednesday Mass', dayOfWeek: 'Wednesday', startTime: '18:00', endTime: '19:00', location: 'Future Church', assignedMembers: [], active: true };
                  const reports = await Promise.all(Array.from({length: 4}, () => service.generateSchedules('2099-11-04', '2099-11-04', [template], {publicationId: 'browser-future'})));
                  const retry = await service.generateSchedules('2099-11-04', '2099-11-04', [template], {publicationId: 'browser-future'});
                  return { created: reports.reduce((total, report) => total + report.created, 0), retry };
                }''')
                assert generation['created'] == 1, generation
                assert generation['retry']['created'] == 0 and generation['retry']['duplicates'] == 1, generation
            context.close()
        browser.close()
    assert historical_snapshot() == before, 'Assignments, history, submissions or publication ownership changed'
    print(json.dumps({'passed': True, 'results': results, 'historical_records_unchanged': True, 'artifacts': str(ARTIFACTS)}, indent=2))


if __name__ == '__main__':
    run()
