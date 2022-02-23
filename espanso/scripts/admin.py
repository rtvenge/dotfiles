#!/usr/bin/python

import re
import os
import requests

replacement = re.search('https?:\/\/[^\/]*', os.environ["ESPANSO_CLIPBOARD"])

resp = requests.get(replacement.group(0) + '/admin')

if resp.status_code == 404:
  print(replacement.group(0) + '/hb_admin')
else:
  print(replacement.group(0) + '/admin')
