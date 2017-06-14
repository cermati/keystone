var keystone = require('../../../');
var _ = require('underscore');
var querystring = require('querystring');
var lodash = require('lodash');
var awsUrlGenerator = require('../../../lib/awsUrlGenerator');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));

exports = module.exports = function(req, res) {
	var options = req.list.options;
	var viewLocals = {
		validationErrors: {},
		showCreateForm: _.has(req.query, 'new')
	};
	
	
	var sort = { by: req.query.sort || req.list.defaultSort };
	var filters = req.list.processFilters(req.query.q);
	var cleanFilters = {};
	var queryFilters = req.list.getSearchFilters(req.query.search, filters, req.query.searchWithRegex);
	var columns = (req.query.cols) ? req.list.expandColumns(req.query.cols) : req.list.defaultColumns;
	
	_.each(filters, function(filter, path) {
		cleanFilters[path] = _.omit(filter, 'field');
	});

	if (sort.by) {

		sort.inv = sort.by.charAt(0) === '-';
		sort.path = (sort.inv) ? sort.by.substr(1) : sort.by;
		sort.field = req.list.fields[sort.path];

		var clearSort = function() {
			delete req.query.sort;
			var qs = querystring.stringify(req.query);
			return res.redirect(req.path + ((qs) ? '?' + qs : ''));
		};

		// clear the sort query value if it is the default sort value for the list
		if (req.query.sort === req.list.defaultSort) {
			return clearSort();
		}

		if (sort.field) {
			// the sort is set to a field, use its label
			sort.label = sort.field.label;
			// some fields have custom sort paths
			if (sort.field.type === 'name') {
				sort.by = sort.by + '.first ' + sort.by + '.last';
			}
		} else if (req.list.get('sortable') && (sort.by === 'sortOrder' || sort.by === '-sortOrder')) {
			// the sort is set to the built-in sort order, set the label correctly
			sort.label = 'display order';
		} else if (req.query.sort) {
			// it looks like an invalid path has been specified (no matching field), so clear the sort
			return clearSort();
		}

	}

	var renderView;
	
	//Switching between implementation of renderView between using and not using API
	if (options.useApi){
		renderView = require('../util/renderViewApi');
	}
	else {
		renderView = require('../util/renderViewMongo');
	}

	var checkCSRF = function() {
		var pass = keystone.security.csrf.validate(req);
		if (!pass) {
			console.error('CSRF failure');
			req.flash('error', 'There was a problem with your request, please try again.');
		}
		return pass;
	};

	var item;
	if ('update' in req.query) {
		if (!checkCSRF()){
			return renderView(req,res,{
				sort: sort,
				filters: filters,
				cleanFilters: cleanFilters,
				queryFilters: queryFilters,
				columns:columns,
				viewLocals:viewLocals
			});
		}
			
		(function() {
			var data = null;
			if (req.query.update) {
				try {
					data = JSON.parse(req.query.update);
				} catch(e) {
					req.flash('error', 'There was an error parsing the update data.');
					return renderView(req,res,{
						sort: sort,
						filters: filters,
						cleanFilters: cleanFilters,
						queryFilters: queryFilters,
						columns:columns,
						viewLocals:viewLocals
					});
				}
			}
			req.list.updateAll(data, function(err) {
				if (err) {
					console.log('Error updating all ' + req.list.plural);
					console.log(err);
					req.flash('error', 'There was an error updating all ' + req.list.plural + ' (logged to console)');
				} else {
					req.flash('success', 'All ' + req.list.plural + ' updated successfully.');
				}
				res.redirect('/keystone/' + req.list.path);
			});
		})();

	}  else if (!req.list.get('nodelete') && req.query['delete']) {

		if (!checkCSRF()) return renderView(req,res,{
			sort: sort,
			filters: filters,
			cleanFilters: cleanFilters,
			queryFilters: queryFilters,
			columns:columns,
			viewLocals:viewLocals
		});

		if (req.query['delete'] === req.user.id) { //eslint-disable-line dot-notation
			req.flash('error', 'You can\'t delete your own ' + req.list.singular + '.');
			return renderView(req,res,{
				sort: sort,
				filters: filters,
				cleanFilters: cleanFilters,
				queryFilters: queryFilters,
				columns:columns,
				viewLocals:viewLocals
			});
		}
		
		//Delete use API directly call the delete endpoint
		if (req.list.options.useApi){
			var s = {};
			var endpoint = req.list.options.apiDetails.delete.endpoint+'/'+req.query.delete;
			switch(lodash.toUpper(req.list.options.apiDetails.delete.method)){
				case 'POST':
					s = superagent.post(endpoint);
					break;
				case 'PATCH':
					s = superagent.patch(endpoint);
					break;
				case 'PUT':
					s = superagent.put(endpoint);
					break;
				case 'DELETE':
					s = superagent.delete(endpoint);
					break;
			}

			s.send(preparedBody)
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
		}
		else {
			req.list.model.findById(req.query['delete']).exec(function (err, item) { //eslint-disable-line dot-notation
				if (err || !item) return res.redirect('/keystone/' + req.list.path);
				
				item.remove(function (err) {
					if (err) {
						console.log('Error deleting ' + req.list.singular);
						console.log(err);
						req.flash('error', 'Error deleting the ' + req.list.singular + ': ' + err.message);
					} else {
						req.flash('success', req.list.singular + ' deleted successfully.');
					}
					res.redirect('/keystone/' + req.list.path);
				});
				
			});
			
		}
		
		return;

	} else if (!req.list.get('nocreate') && req.list.get('autocreate') && _.has(req.query, 'new')) {
		
		if (!checkCSRF()) return renderView(req,res,{
			sort: sort,
			filters: filters,
			cleanFilters: cleanFilters,
			queryFilters: queryFilters,
			columns:columns,
			viewLocals:viewLocals
		});

		item = new req.list.model();
		item.save(function(err) {

			if (err) {
				console.log('There was an error creating the new ' + req.list.singular + ':');
				console.log(err);
				req.flash('error', 'There was an error creating the new ' + req.list.singular + '.');
				renderView(req,res,{
					sort: sort,
					filters: filters,
					cleanFilters: cleanFilters,
					queryFilters: queryFilters,
					columns:columns,
					viewLocals:viewLocals
				});

			} else {
				req.flash('success', 'New ' + req.list.singular + ' ' + req.list.getDocumentName(item) + ' created.');
				return res.redirect('/keystone/' + req.list.path + '/' + item.id);
			}

		});

	} else if (!req.list.get('nocreate') && req.method === 'POST' && req.body.action === 'create') {

		if (!checkCSRF()) return renderView(req,res,{
			sort: sort,
			filters: filters,
			cleanFilters: cleanFilters,
			queryFilters: queryFilters,
			columns:columns,
			viewLocals:viewLocals
		});


		//Create new item directly send form data that already prepared to the endpoint
		if (req.list.options.useApi){
			var body = req.body;
			var postBody = {};
			_.forEach(_.keys(body),function(key){
				
				var value=body[key];
				if (_.contains(key,'_') && (key.indexOf('time')!==-1 || key.indexOf('date')!==-1)){
					var split=key.split('_');
					
					if (!_.has(postBody,split[0])) postBody[split[0]]=' ';
					if (split[1]=='time') postBody[split[0]]=postBody[split[0]]+value;
					if (split[1]=='date') postBody[split[0]]=value+postBody[split[0]];
				}
				else{
					postBody[key]=value;
				}
			})
			
			postBody=_.omit(postBody,['_csrf','action']);

			var preparedBody = req.list.options.apiDetails.create.prepareRequestData(postBody);
			superagent.post(req.list.options.apiDetails.create.endpoint)
				.send(preparedBody)
				.set('Accept', 'application/json')
				.endAsync()
				.then(function(result){
					req.flash('success', 'New ' + req.list.singular + ' created.');
					return res.redirect('/keystone/' + req.list.path + '/' + result.body.result.id);
				})
				.catch(function(err){
					req.flash('error', 'Failed create new ' + req.list.singular + ' | ' + err);
					return res.redirect('/keystone/' + req.list.path);
				});
			
		}
		else{
			item = new req.list.model();
			var updateHandler = item.getUpdateHandler(req);

			viewLocals.showCreateForm = true; // always show the create form after a create. success will redirect.

			if (req.list.nameIsInitial) {
				if (!req.list.nameField.validateInput(req.body, true, item)) {
					updateHandler.addValidationError(req.list.nameField.path, req.list.nameField.label + ' is required.');
				}
				req.list.nameField.updateItem(item, req.body);
			}

			updateHandler.process(req.body, {
				// flashErrors: true,
				logErrors: true,
				fields: req.list.initialFields
			}, function(err) {
				if (err) {
					viewLocals.createErrors = err;
					return renderView(req,res,{
						sort: sort,
						filters: filters,
						cleanFilters: cleanFilters,
						queryFilters: queryFilters,
						columns:columns,
						viewLocals:viewLocals
					});
				}
				req.flash('success', 'New ' + req.list.singular + ' ' + req.list.getDocumentName(item) + ' created.');
				return res.redirect('/keystone/' + req.list.path + '/' + item.id);
			});
		}
	} else {

		renderView(req,res,{
			sort: sort,
			filters: filters,
			cleanFilters: cleanFilters,
			queryFilters: queryFilters,
			columns:columns,
			viewLocals:viewLocals
		});

	}
};
