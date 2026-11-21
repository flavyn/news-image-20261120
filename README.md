# World news image: 20 November 2026

[![make.fun news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/flavyn/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/flavyn/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261120)

This entry supplies a world news image for 20 November 2026. The image is `entry.png` beside `main.ts`. With Node 22, run `MAKEFUN_OUTPUT_DIR=out node main.ts` (PowerShell: `$env:MAKEFUN_OUTPUT_DIR='out'; node main.ts`). The program validates the image and copies it to `entry.png` in that directory, creating the directory when needed; the default destination is `/output`. The gate accepts complete PNG or JPEG files up to 1,048,576 bytes, with width and height each from 1 to 1024 pixels. PNG validation checks chunk boundaries, types, ordering and CRCs through IEND; JPEG validation walks frame and scan segments through EOI. Invalid files produce one stderr line and a nonzero exit code.
