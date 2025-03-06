default: gen

gen:  api-code-gen-ts 


api-code-gen-ts: #generate/refresh typescript apis
	rm -Rf ./app/ts-api/src/api-gen ; true
	java -jar openapi-generator-cli-7.1.0.jar generate -i ./api-schema/iwf-web.yaml -g typescript-axios -o ./app/ts-api/src/api-gen --git-user-id xworkflow --git-repo-id iwf-web

