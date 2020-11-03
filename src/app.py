#!/usr/bin/python3

"""Main entry point for the web app
This file serves the dynamic content generated by flask, and also converts
these pages to static HTML.
"""

import glob
import os

from flask import Flask, render_template, send_from_directory
app = Flask(__name__)
app.config['FREEZER_REMOVE_EXTRA_FILES'] = False
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['DEBUG']=False
jinja_options = app.jinja_options.copy()
jinja_options.update(dict(
    block_start_string='"%',
    block_end_string='%"',
    variable_start_string='**',
    variable_end_string='**',
    comment_start_string='<#',
    comment_end_string='#>',
))
app.jinja_options = jinja_options

@app.route('/')
def hello_world():
    latest_directory = max(glob.iglob('build/data/*/*/*'), key=os.path.getctime)
    target = latest_directory.split('/')
    all_dates = glob.glob('build/data/*/*/*')
    all_dates.sort(key=os.path.getmtime, reverse=True)
    list_dates = ([i.split('/')[2:] for i in all_dates])
    list_dates = [' / '.join(i) for i in list_dates]
    if app.config['DEBUG']:
        return render_template('week.html', repo_name="..", season=target[2], gw=target[3], date=target[4], list_dates=list_dates)
    else:
        return render_template('week.html', repo_name="fpl_optimized", season=target[2], gw=target[3], date=target[4], list_dates=list_dates)

def list_all_snapshots():
    pass

@app.route('/data/<path:path>')
def read_data(path):
    print(path)
    return send_from_directory('build', 'data/' + path)

if __name__ == "__main__":
    
    
    
    app.config['DEBUG']=True

    from app import app
    app.run(host='0.0.0.0', port=5000, debug=True)

