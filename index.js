var uriTemplates = require('uri-templates');

var dateFormat = require('dateformat');

var headlessURITemplates = {
	"RENDERED_CONTENT": uriTemplates("/o/headless-delivery/v1.0/structured-contents/{structuredContentId}/rendered-content/{templateId}"),
	"STRUCTURED_CONTENT": uriTemplates("/o/headless-delivery/v1.0/structured-contents/{structuredContentId}/"),
	"STRUCTURED_CONTENT_BY_KEY": uriTemplates("/o/headless-delivery/v1.0/sites/{siteId}/structured-contents/by-key/{key}/")
}

var request = require('request');
var fs = require("fs");

var winston = require("winston");
var logger = new winston.Logger({
    level: 'debug',
    transports: [
        new(winston.transports.Console)()
    ]
});


var EXPECTED_RETURN_CODES = {
    "GET": 200,
    "POST": 201, // 201 = created
    "PATCH": 200
};

var configDummy = {
    "password": "password",
    "user": "allen.ziegenfus@liferay.com",
    "liferay_server": "https://webserver-liferaywww-upgrade.us-west-1.lfr.cloud"
}

var configFile = "./config.json";
var config;
try {
    config = JSON.parse(fs.readFileSync(configFile));
} catch (error) {
    logger.error("Please create config file " + configFile + " with the following syntax in the current directory");
    logger.error(JSON.stringify(configDummy) + "\n");
    throw new Error("Could not find config file: " + configFile);
}

var btoa = require('btoa');

function swagger_api_request(config, method, endpoint, body, name, cb) {
    logger.info("Invoking " + endpoint);

    request({
        method: method,
        url: endpoint,
        body: body,
        json: true,
        headers: {
			"Accept": "text/html, application/json",
            "Authorization": "Basic " + btoa(config.user + ":" + config.password)
        },
        time: true
    }, function(err, response) {

        if (response && response.statusCode) {
            logger.info("Http Response: " + response.statusCode);
        }
        if (err) {
            logger.error(err);
            throw err;
        } else if (response && response.statusCode && (response.statusCode != EXPECTED_RETURN_CODES[method])) {
            logger.error("An error seems to have occurred. Response Code " + response.statusCode, body);
            var errorobj = {
                statusCode: response.statusCode,
                body: body
            };
            throw errorobj;
        }

		if (response.headers["content-type"] == "text/html") {
			fs.writeFile("results/" + name + ".html",response.body);
		} else {
			var json = response.body;
			fs.writeFile("results/" + name + ".json", JSON.stringify(json, null, "\t"));
			if (json.content && json.encoding && json.encoding == "base64") {
				var buf = Buffer.from(json.content, json.encoding);
				fs.writeFile("results/" + name, buf);
			}
		}
        logger.info('Request time for ' + name + ' in ms', response.elapsedTime);
        if (cb) cb(json);
    });
}


var requestDefaults = {
};

var getFile = function(filename) {
    try {
        return Buffer.from(fs.readFileSync(filename)).toString("base64");
    } catch (error) {
        throw new Error("Could not find file: " + filename);
    }
};

function getEndpoint(template, params) {
    return config.liferay_server + template.fill(Object.assign({}, requestDefaults, params));
}

var timestampString = dateFormat(new Date(), "yyyy-mm-dd") + "T" + dateFormat(new Date(), "UTC:HH:MM:ss") + "Z";


var paths = {
	commands: "./requests",
	results: "./results",
};

fs.readdir(paths.commands, function(err, command_files) {
	command_files.forEach(function(command_file) {
		var cmd = JSON.parse(fs.readFileSync(paths.commands + "/" + command_file));
		logger.info("Invoking " + command_file);


		swagger_api_request(
			config,
			 "GET", 
			 getEndpoint(
				 headlessURITemplates[cmd.template], 
				 cmd
				), 
			{}, 
			command_file,
			function() {});
	
	});
});



