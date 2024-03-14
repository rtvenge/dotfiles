#!/usr/bin/python

import re
import os
import requests
import urllib.parse

fullURL = os.environ["ESPANSO_CLIPBOARD"]
rootURL = re.search('https?://[^/]*', fullURL)
encodedURL = urllib.parse.quote(fullURL, safe="")

if 'lndo.site' in rootURL.group(0):
  print(rootURL.group(0) + '/hb_admin?redirect_to=' + encodedURL + '&reauth=1')
elif 'hbserver.dev' in rootURL.group(0):
  print(rootURL.group(0) + '/hb_admin?redirect_to=' + encodedURL + '&reauth=1')
else:
  resp = requests.get(rootURL.group(0) + '/wp-login.php?redirect_to=' + encodedURL + '&reauth=1')

  if resp.status_code == 404:
    print(rootURL.group(0) + '/hb_admin?redirect_to=' + encodedURL + '&reauth=1')
  else:
    print(rootURL.group(0) + '/wp-login.php?redirect_to=' + encodedURL + '&reauth=1')