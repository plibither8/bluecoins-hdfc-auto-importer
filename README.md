# bluecoins-hdfc-auto-importer

> 💰🔔 Auto-imports transactions from my HDFC bank account into Bluecoins

## Procedure

1. Get new transactions from HDFC Netbanking
2. Check if there are new transactions
3. If yes, download latest backup files from Dropbox
4. Send a message on Telegram regarding the transaction
5. Add the new transaction to the backup database
6. Upload the updated database back to Dropbox
7. [Manually done] QuickSync with Dropbox on the Bluecoins app.

Done by scraping via Puppeteer. Polls transaction list every 5 minutes using an external crontab.

## License

[MIT](LICENSE)
