var keystone = require('../../../');
var _ = require('underscore');
var lodash = require('lodash');
var async = require('async');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));

exports = module.exports = function(req, res) {
	var apiDetails = req.list.options.apiDetails.read;
	var endpoint = apiDetails.endpoint + '/' + req.params.item;
	
	if (req.method === 'GET') {
		
		superagent
			.getAsync(endpoint)
			.then(function (res) {
				/**
				 * getResponseData parameter accept object {data:..., raw: ....} where data contain res.body from API and raw contains operation detail and etc
				 * operation='item' is operation where keystone access to get single item with certain ID and
				 * operation='listing' is operation where keystone access to get list of items 
				 */
				return {
					data: res.body,
					raw: {
						operation: 'item'
					}
				};
			})
			.then(function(responseBody){
				return req.list.options.apiDetails.read.getResponseData(responseBody);
			})
			.then(function (item) {
				item.get = function (colName) {
					return this[colName];
				}
				
				var renderView = function () {
	
					var appName = keystone.get('name') || 'Keystone';
	
					keystone.render(req, res, 'item', {
						section: keystone.nav.by.list[req.list.key] || {},
						title: appName + ': ' + req.list.singular + ': ' + req.list.getDocumentName(item),
						page: 'item',
						list: req.list,
						item: item,
						relationships: {},
						showRelationships: {}
					});
				}
				renderView();
			})
			.catch(function (err) {
				req.flash('error', 'Error, item not found ' + err);
				return res.redirect('/keystone/' + req.list.path)
			})
	}
	else if (req.method === 'POST' && req.body.action === 'updateItem' && !req.list.get('noedit')) {

		if (!keystone.security.csrf.validate(req)) {
			console.error('CSRF failure', req.method, req.body);
			req.flash('error', 'There was a problem with your request, please try again.');
			return renderView();
		}


		var body = req.body;
		var postBody = {};

		/**
		 * Construct plain javascript object from "create form" from Admin UI
		 * If you have Type.datetime in your list, it will create [your_field_name]_date and [your_field_name]_time
		 * so we must concat date and time to be one field
		 */
		_.forEach(_.keys(body),function(key){
			var value = body[key];

			/**
			 * Concat date and time field, checking if this field is a time or date field
			 * if true, concat these fields together
			 */
			if (_.contains(key,'_') && (key.indexOf('time') !== -1 || key.indexOf('date') !== -1)){
				var split = key.split('_');

				if (!_.has(postBody,split[0])) postBody[split[0]] = ' ';
				if (split[1] == 'time') postBody[split[0]] = postBody[split[0]] + value;
				if (split[1] == 'date') postBody[split[0]] = value + postBody[split[0]];
				
			} else {
				postBody[key] = value;
			}
		})

		postBody=_.omit(postBody,['_csrf','action']);

		/**
		 * Call prepareRequestData, it will mapping between our plain javascript obj and payload data to the API
		 */
		var preparedBody = req.list.options.apiDetails.update.prepareRequestData(postBody);
		var request;
		switch(lodash.toUpper(req.list.options.apiDetails.update.method)){
			case 'POST':
				request = superagent.post(endpoint);
				break;
			case 'PATCH':
				request = superagent.patch(endpoint);
				break;
			case 'PUT':
				request = superagent.put(endpoint);
				break;
		}

		request.send(preparedBody)
			.set('Accept', 'application/json')
			.endAsync()
			.then(function(result){
				req.flash('success', 'Update ' + req.list.singular + ' success.');
				return res.redirect('/keystone/' + req.list.path + '/' + req.params.item);
			})
			.catch(function(err){
				req.flash('error', 'Failed update ' + req.list.singular + ' | ' + err);
				return res.redirect('/keystone/' + req.list.path);
			});
	} else {
		renderView();
	}
	
};
