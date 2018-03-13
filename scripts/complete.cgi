#!/usr/bin/python3.5

'''
Server Endpoint for 3D Auto Completion web tool.
'''

import cgi
import json
import os
import sys


def handle_request():
    '''
    Handle the request sent from the client.
    '''
    # data = sys.stdin.read(int(os.environ.get('HTTP_CONTENT_LENGTH', 0)))
    form = cgi.FieldStorage()
    data = form.getvalue('data')
    # data = json.loads(data)

    # print(os.environ.get('HTTP_CONTENT_LENGTH'))
    print(str(data))


print('Content-type: application/json\n')
handle_request()
