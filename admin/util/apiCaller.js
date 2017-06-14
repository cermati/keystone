var _ = require('lodash');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));

/**
 * @returns {Promise<Array<Object>>}
 */
exports.call = function(url, method) {
	switch (_.toUpper(method)){
		case 'GET':
			return superagent
				.getAsync(url)
				.then(function (res) {
					console.log(res.body.results);
					return res.body;
				})
				.catch(function(){
						console.log("error calling api");
					}
				);
			break;
	}
	
}
