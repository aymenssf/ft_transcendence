start:
	docker compose up
stop:
	docker compose down
re : stop start

prune: stop
	docker system prune -a --volumes