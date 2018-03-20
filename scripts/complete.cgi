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


def get_dir_name():
    '''
    Return name of the directory where all of the temporary files will be kept.
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

        dir_name = get_dir_name()
        # Making sure we don't rewrite something
        while os.path.isdir(dir_name):
            dir_name = get_dir_name()
        os.makedirs(dir_name)
        input_file_name = os.path.join(dir_name, 'input')
        input_file = open(input_file_name, 'w')

        for x, y, z in zip(data['x'], data['y'], data['z']):
            input_file.write('v %s %s %s\n' % (x, y, z))
        input_file.close()

        progress_file = open(os.path.join(dir_name, 'progress'), 'w')
        progress_file.write('0\n')
        progress_file.close()

        run_completion(input_file_name)

        response = {
            'status': 'ok',
            'dirname': dir_name.split('/')[-1],
        }
        print(json.dumps(response))

    elif task == 'progress':
        dirname = form.getvalue('dirname')
        progress_file = open('data/%s/progress' % dirname)
        response = {
            'status': 'ok',
            'progress': progress_file.readline(),
        }
        progress_file.close()
        print(json.dumps(response))

    elif task == 'get_results':
        dirname = form.getvalue('dirname')
        candidate_num = form.getvalue('candidate_num')
        results_file = open('data/%s/complete_%s' % (dirname, candidate_num))
        response = {
            'status': 'ok',
            'data': ''.join(results_file.readlines()),
        }
        results_file.close()
        print(json.dumps(response))

    elif task == 'get_candidates':
        dirname = form.getvalue('dirname')
        candidates_file = open('data/%s/candidates' % (dirname))
        candidates = candidates_file.readlines()
        candidates_file.close()

        cand_list = []
        for candidate in candidates:
            cand_param = {}
            [
                cand_param['a'],
                cand_param['b'],
                cand_param['c'],
                cand_param['d']
            ] = candidate.split(' ')
            cand_list.append(cand_param)

        response = {
            'status': 'ok',
            'data': cand_list,
        }
        print(json.dumps(response))


print('Content-type: application/json\n')
handle_request()
