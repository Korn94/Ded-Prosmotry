@echo off
chcp 65001 >nul
title Ded-Prosmotry  -  запуск одной кнопкой
cd /d "%~dp0"

set "REPO=https://github.com/Korn94/Ded-Prosmotry.git"
set "CODE_DIR=код"
set "APP_DIR=%CD%\%CODE_DIR%"
set "NEED_INSTALL=0"

echo =========================================================
echo     Ded-Prosmotry  -  запуск одной кнопкой
echo =========================================================
echo.

echo [1/5] Проверяю наличие Node.js...
where node >nul 2>&1
if errorlevel 1 goto NoNode
echo       - Node.js найден.

for /f "tokens=1 delims=.v" %%M in ('node -v') do set "NODE_MAJOR=%%M"
if %NODE_MAJOR% LSS 20 (
    echo.
    echo     [ВНИМАНИЕ] Версия Node.js может быть старой для этого
    echo     проекта. Если возникнут ошибки - скачайте свежую версию
    echo     с сайта https://nodejs.org и запустите этот файл заново.
    echo.
    timeout /t 4 >nul
)

echo [2/5] Проверяю наличие Git...
where git >nul 2>&1
if errorlevel 1 goto NoGit
echo       - Git найден.

echo [3/5] Проверяю папку проекта...
if exist "%APP_DIR%\.git" goto Update
if exist "%APP_DIR%" goto CloneFresh
goto Clone

:Clone
echo       - Проект ещё не скачан. Скачиваю с GitHub...
git clone -- "%REPO%" "%APP_DIR%"
if errorlevel 1 goto CloneFail
set "NEED_INSTALL=1"
goto Update

:CloneFresh
echo       - Прошлое скачивание не завершилось. Скачиваю заново...
rmdir /s /q "%APP_DIR%"
git clone -- "%REPO%" "%APP_DIR%"
if errorlevel 1 goto CloneFail
set "NEED_INSTALL=1"

:Update
cd /d "%APP_DIR%"
echo.
echo [4/5] Проверяю обновления на GitHub...
git fetch --quiet origin 2>nul
if errorlevel 1 goto FetchFail

for /f %%L in ('git rev-parse HEAD') do set "LOCAL=%%L"
for /f %%L in ('git rev-parse origin/main') do set "REMOTE=%%L"

if not "%LOCAL%"=="%REMOTE%" goto UpdateAvailable
echo       - Обновлений нет, у вас последняя версия.
goto CheckInstall

:UpdateAvailable
echo       - Найдена новая версия! Обновляю...
git pull --ff-only
if errorlevel 1 goto PullFail
git diff --quiet HEAD origin/main -- package.json package-lock.json
if errorlevel 1 set "NEED_INSTALL=1"
goto CheckInstall

:FetchFail
echo       - Не удалось проверить обновления (нет Интернета?).
echo         Запускаю проект в текущей версии.

:CheckInstall
if exist "%APP_DIR%\node_modules" goto NodeModsOk
set "NEED_INSTALL=1"
:NodeModsOk
if "%NEED_INSTALL%"=="0" goto Run

echo.
echo [5/5] Устанавливаю библиотеки (в первый раз или после обновления).
echo       Это может занять несколько минут...
call npm install
if errorlevel 1 goto InstallFail
echo       - Готово.

:Run
echo.
echo =========================================================
echo     Запускаю проект...
echo.
echo     Когда появится текст похожий на:
echo         http://localhost:3000/
echo     - откройте этот адрес в браузере.
echo.
echo     Чтобы остановить проект - нажмите Ctrl+C в этом окне.
echo =========================================================
echo.
call npm run dev

echo.
echo Проект остановлен. Можно закрывать это окно.
pause
exit /b 0

:NoNode
echo.
echo [ОШИБКА] Не найдена программа Node.js.
echo Она обязательна и нужна, чтобы запускать проект.
echo Установите её один раз (5 минут):
echo.
echo   1. Откройте сайт:  https://nodejs.org
echo   2. Нажмите зелёную кнопку "LTS" - скачается установщик
echo   3. Запустите скачанный файл и жмите "Далее / Next" до конца
echo   4. Закройте это окно и перезапустите компьютер
echo   5. Запустите этот файл заново
echo.
start "" "https://nodejs.org"
echo Открою сайт Node.js. После установки повторите запуск.
pause
exit /b 1

:NoGit
echo.
echo [ОШИБКА] Не найдена программа Git.
echo Она нужна, чтобы скачивать и обновлять проект.
echo Установите её один раз:
echo.
echo   1. Откройте сайт: https://git-scm.com/download/win
echo   2. Нажмите синюю кнопку "64-bit" и скачайте файл
echo   3. Запустите файл и жмите "Далее / Next" до конца
echo   4. Закройте это окно и перезапустите компьютер
echo   5. Запустите этот файл заново
echo.
start "" "https://git-scm.com/download/win"
echo Открою сайт Git. После установки повторите запуск.
pause
exit /b 1

:CloneFail
echo.
echo [ОШИБКА] Не удалось скачать проект с GitHub.
echo Проверьте подключение к Интернету и запустите файл ещё раз.
pause
exit /b 1

:PullFail
echo.
echo [ВНИМАНИЕ] Не удалось применить обновление.
echo Ваши данные не повреждены. Запускаю проект в текущей версии.
goto CheckInstall

:InstallFail
echo.
echo [ОШИБКА] Не удалось установить библиотеки.
echo Иногда это лечится простым перезапуском файла.
echo Если ошибка повторяется - просто запустите этот файл ещё раз.
pause
exit /b 1