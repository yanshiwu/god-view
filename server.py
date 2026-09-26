# -*- coding: utf-8 -*-
# 开发服务器:禁用一切缓存,保证刷新即最新
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, *a): pass

ThreadingHTTPServer(('127.0.0.1', 8437), H).serve_forever()
