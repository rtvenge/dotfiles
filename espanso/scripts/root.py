#!/usr/bin/python

import re
import os

replacement = re.search('https?:\/\/[^\/]*', os.environ["ESPANSO_CLIPBOARD"])

print(replacement.group(0))
