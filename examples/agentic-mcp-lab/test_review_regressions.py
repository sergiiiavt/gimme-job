import contextlib
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest.mock import patch
import agent
import server

META={server.META_VERSION:server.PROTOCOL_VERSION,server.META_CAPABILITIES:{}}
class ReviewRegressions(unittest.TestCase):
    def test_malformed_envelopes_do_not_terminate_stdio_session(self):
        requests=[]
        for invalid in [[], 'text', 1, True, None]:
            requests += [{'jsonrpc':'2.0','id':len(requests),'method':'tools/list','params':invalid}]
            requests += [{'jsonrpc':'2.0','id':len(requests),'method':'tools/list','params':{'_meta':invalid}}]
        requests.append({'jsonrpc':'2.0','id':99,'method':'tools/list','params':{'_meta':META}})
        result=subprocess.run([sys.executable,server.__file__],input='\n'.join(map(json.dumps,requests))+'\n',capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        replies=[json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual([reply['error']['code'] for reply in replies[:-1]],[-32602]*10)
        self.assertEqual(replies[-1]['id'],99)
        self.assertIn('tools',replies[-1]['result'])

    def test_missing_run_is_an_explicit_error_even_on_last_step(self):
        for budget in [1,8]:
            report=agent.run_triage('run-1',budget)
            self.assertEqual(report['stop_reason'],'tool error')
            self.assertTrue(report['errors'])
            self.assertEqual(report['proposals'],[])

    def test_failed_history_or_proposal_preserves_partial_evidence(self):
        original=agent.StdioClient.call_tool
        for failed_tool in ['ci_test_history','ci_propose_quarantine']:
            def injected(client,name,arguments):
                return server.tool_error('injected failure') if name==failed_tool else original(client,name,arguments)
            with patch.object(agent.StdioClient,'call_tool',injected):
                report=agent.run_triage('run-512')
            self.assertEqual(report['stop_reason'],'tool error')
            self.assertEqual(report['errors'][0]['tool'],failed_tool)
            self.assertGreaterEqual(len(report['trace']),2)
            self.assertFalse(report['proposals'])

    def test_policy_never_treats_tool_error_as_done(self):
        with self.assertRaises(agent.ToolFailure):agent.scripted_policy([{'isError':True}],'run-512')

    def test_english_and_ukrainian_teaching_budget_is_exact_and_retains_latest_request(self):
        for suffix in ['', '.uk']:
            path=Path(__file__).resolve().parents[2]/f'content/agentic-learning/04-state-memory-rag{suffix}.md'
            source=re.search(r'```python\n(.*?)\n```',path.read_text(encoding='utf-8'),re.S)[1]
            namespace={}
            with contextlib.redirect_stdout(io.StringIO()):exec(compile(source,str(path),'exec'),namespace)
            for budget in [90,160,1000]:
                history,used=namespace['fit_history']('You are a QA mentor.',namespace['turns'],budget)
                self.assertLessEqual(used,budget)
                self.assertEqual(used,sum(4+(len(item['content'])+3)//4 for item in history))
                self.assertIn(namespace['turns'][-1],history)
            with self.assertRaises(ValueError):namespace['fit_history']('System',[{'role':'user','content':'x'*1000}],10)
            self.assertEqual(namespace['fit_history']('s',[],20)[1],5)

if __name__=='__main__':unittest.main()
