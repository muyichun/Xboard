必选：
1. .docker/.data/database.sqlite
2. env

可选：
plugins/
storage/theme/
storage/app/


重启：
git clone --recurse-submodules \
  -b muyichun \
  https://github.com/muyichun/Xboard.git

cd Xboard
mkdir -p .docker/.data

docker compose up -d