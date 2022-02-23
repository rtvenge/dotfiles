#!/usr/bin/python

import re
import os
import urllib.parse

replacement = re.search('https?:\/\/[^\/]*', os.environ["ESPANSO_CLIPBOARD"])

print(replacement.group(0) + '/wp-login.php?redirect_to=' + urllib.parse.quote(os.environ["ESPANSO_CLIPBOARD"], safe=""))
