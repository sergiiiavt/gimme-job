import json
from pathlib import Path
import subprocess
import sys
import unittest
import practice

class PracticeTests(unittest.TestCase):
    def test_reference_and_track_coverage(self):
        for result in practice.check_candidate(practice, 'all'):
            with self.subTest(case=result['case']):
                self.assertTrue(result['passed'], result)
        for track in practice.TRACKS:
            self.assertGreaterEqual(len(practice.check_candidate(practice, track)), 3)

    def test_wrong_bva_fails_independent_expected_values(self):
        class Wrong:
            @staticmethod
            def boundary_values(lower, upper, variant):
                return [lower-1, lower, lower+1, upper-1, upper, upper+1]
        result = next(x for x in practice.check_candidate(Wrong, 'ctfl') if x['case']=='bva-three')
        self.assertFalse(result['passed'])

    def test_cli_reference_succeeds_and_starter_fails(self):
        for extra, expected in [([],0),(['--candidate',str(Path(__file__).with_name('starter.py'))],1)]:
            result = subprocess.run([sys.executable,practice.__file__,'platform',*extra],capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode, expected, result.stderr)
            self.assertGreater(json.loads(result.stdout)['total'],0)

    def test_hook_stdin_exit_status_and_streams(self):
        hook=Path(__file__).with_name('hooks')/'block_fixture_write.py'
        for event,expected in [({'tool_name':'Edit','tool_input':{'file_path':'sandbox/.env.training'}},2),({'tool_name':'Write','tool_input':{'file_path':'sandbox/answer.py'}},0),({'tool_name':'Read','tool_input':{'file_path':'sandbox/.env.training'}},0),([],2),({'tool_input':[]},2)]:
            result=subprocess.run([sys.executable,str(hook)],input=json.dumps(event),capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,expected)
            self.assertEqual(result.stdout,'')
            if expected: self.assertTrue(result.stderr)

if __name__=='__main__': unittest.main()
