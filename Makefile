.PHONY: install migrate daemon frontend up health

install:
	npm install

migrate:
	npm run migrate --workspace daemon

daemon:
	npm run dev --workspace daemon

frontend:
	npm run dev --workspace frontend

up:
	@echo "Starting daemon and frontend (Ctrl+C to stop both)..."
	npx concurrently -n daemon,frontend -c blue,magenta \
		"npm run dev --workspace daemon" \
		"npm run dev --workspace frontend"

health:
	curl -s http://127.0.0.1:4700/api/health | python3 -m json.tool
