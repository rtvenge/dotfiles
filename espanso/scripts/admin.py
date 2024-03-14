#!/usr/bin/python

import re
import os
import requests
import urllib.parse

fullURL = os.environ["ESPANSO_CLIPBOARD"]
rootURL = re.search('https?:\/\/[^\/]*', fullURL)

if 'lndo.site' in rootURL.group(0):
  print(rootURL.group(0) + '/hb_admin')
elif 'hbserver.dev' in rootURL.group(0):
  print(rootURL.group(0) + '/hb_admin')
else:
  resp = requests.get(rootURL.group(0) + '/wp-admin/')

  if resp.status_code == 404:
    print(rootURL.group(0) + '/hb_admin')
  else:
    print(rootURL.group(0) + '/wp-admin/')