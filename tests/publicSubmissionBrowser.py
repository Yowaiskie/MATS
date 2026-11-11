import json
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:8080/v1/projects/demo-mats-public-submission/databases/(default)/documents/'


def read_fixture(path):
    with urlopen(Request(BASE + path, headers={'Authorization': 'Bearer owner'}), timeout=10) as response:
        return json.load(response)


def run():
    artifact = Path('.firebase/public-submission-verification')
    artifact.mkdir(parents=True, exist_ok=True)
    before = {path: read_fixture(path) for path in ['schedules/wednesday', 'schedules/friday-full', 'schedulePublications/public-cycle']}
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for member, width, height in [('desktop', 1280, 900), ('messenger', 390, 844)]:
            options = {'viewport': {'width': width, 'height': height}, 'is_mobile': member == 'messenger', 'has_touch': member == 'messenger'}
            if member == 'messenger':
                options['user_agent'] = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 [FBAN/Orca-Android;FBAV/490.0.0.0.0;]'
            context = browser.new_context(**options)
            context.route('**/*', lambda route: route.continue_() if urlparse(route.request.url).hostname in ['127.0.0.1', 'localhost'] else route.abort())
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto('http://127.0.0.1:5175/tests/browser/publicSubmission.html', wait_until='domcontentloaded')
            picker = page.get_by_role('button', name='Click to search / select your name...')
            expect(picker).to_be_visible(timeout=60000)
            picker.click()
            page.get_by_placeholder('Type to search name or order...').fill(member.capitalize())
            page.get_by_text(f'Server, {member.capitalize()}', exact=True).click()
            page.locator('td div.border-dashed').first.click()
            page.get_by_role('button', name=re.compile(r'^Submit\s') if member == 'messenger' else 'Submit Schedule Preferences').locator('visible=true').click()
            page.get_by_role('button', name='Submit Preferences', exact=True).click()
            expect(page.get_by_text('Submission Received!', exact=True)).to_be_visible(timeout=15000)
            saved = read_fixture(f'scheduleSubmissions/public-cycle_{member}')['fields']
            assert saved['status']['stringValue'] == 'pending'
            summary = saved['slotSummaries']['arrayValue']['values'][0]['mapValue']['fields']
            assert 'location' not in summary
            assert summary['startTime']['stringValue'] == '18:00'
            assert summary['scheduleIds']['arrayValue']['values'] == [{'stringValue': 'wednesday'}]
            assert not errors, errors
            page.screenshot(path=str(artifact / f'submission-success-{member}.png'), full_page=True)
            page.get_by_role('button', name='Got it', exact=True).click()
            page.reload(wait_until='domcontentloaded')
            expect(page.get_by_role('button', name='Click to search / select your name...')).to_be_visible(timeout=15000)
            page.get_by_role('button', name='Click to search / select your name...').click()
            page.get_by_placeholder('Type to search name or order...').fill(member.capitalize())
            page.get_by_text(f'Server, {member.capitalize()}', exact=True).click()
            if member == 'messenger':
                expect(page.get_by_text('Submission Received (Pending Review)', exact=False).locator('visible=true').first).to_be_visible()
            else:
                expect(page.locator(':text-is("Schedule Already Submitted"):visible').first).to_be_visible()
            results.append({'context': member, 'anonymous_public_submission': 'passed', 'missing_location_omitted': True, 'duplicate_submission_blocked': True, 'page_errors': errors})
            context.close()
        browser.close()
    assert {path: read_fixture(path) for path in before} == before, 'Official schedules or publication assignments changed'
    print(json.dumps({'passed': True, 'results': results, 'official_assignments_unchanged': True}, indent=2))


if __name__ == '__main__':
    run()
