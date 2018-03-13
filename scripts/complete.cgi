#!/usr/bin/python3.5

'''
Server Endpoint for 3D Auto Completion web tool.
'''

import cgi
import json
import random
import os
import string

TOOL_PATH = '/media/bmakan/dev-space/computer-vision/semestral-project/cmake-build-debug/SymmetryDetection3D'


def run_completion(filename):
    '''
    Run the Automatic 3D Completion Tool on a given file.
    '''
    os.system('bash -c "batch <<< \\"%s %s\\""' % (TOOL_PATH, os.path.abspath(filename)))


def get_output_file_name():
    '''
    Get name for the output file of the temporary object.
    '''
    return 'data/%s' % (''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(20)))


def handle_request():
    '''
    Handle the request sent from the client.
    '''
    form = cgi.FieldStorage()
    task = form.getvalue('task')

    if task == 'submit':
        # Dictionary contains x, y, z keys with lists of coordinates
        data = form.getvalue('data')
        data = json.loads(data)

        output_file_name = get_output_file_name()
        # Making sure we don't rewrite something
        while os.path.isfile(output_file_name):
            output_file_name = get_output_file_name()
        output_file = open(output_file_name, 'w')

        for x, y, z in zip(data['x'], data['y'], data['z']):
            output_file.write('v %s %s %s\n' % (x, y, z))
        output_file.close()

        progress_file = open('%s.progress' % output_file_name, 'w')
        progress_file.write('0\n')
        progress_file.close()

        run_completion(output_file_name)

        response = {
            'status': 'ok',
            'filename': output_file_name.split('/')[-1]
        }
        print(json.dumps(response))

    elif task == 'progress':
        filename = form.getvalue('filename')
        progress_file = open('data/%s.progress' % filename)
        response = {
            'status': 'ok',
            'progress': progress_file.readline(),
        }
        progress_file.close()
        print(json.dumps(response))

    elif task == 'get_results':
        filename = form.getvalue('filename')
        results_file = open('data/%s.complete' % filename)
        response = {
            'status': 'ok',
            'data': ''.join(results_file.readlines()),
        }
        results_file.close()
        print(json.dumps(response))


print('Content-type: application/json\n')
handle_request()
