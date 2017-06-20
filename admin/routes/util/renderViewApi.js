/**
 * Created by tpratama on 6/7/17.
 */
var keystone = require('../../../');
var _ = require('underscore');
var lodash = require('lodash');
var Bluebird = require('bluebird');
var querystring = require('querystring');
var awsUrlGenerator = require('../../../lib/awsUrlGenerator');

module.exports = function(req,res, params) {
	
	var sort = params.sort;
	var filters = params.filters;
	var cleanFilters = params.cleanFilters;
	var queryFilters = params.queryFilters;
	var columns = params.columns;
	var viewLocals = params.viewLocals;
	var query = req.list.paginate({ 
		filters: queryFilters, 
		page: req.query.page, 
		perPage: req.query.perPage, 
		apiDetails: req.list.options.apiDetails
	});
	var link_to = function(params) {
		var queryParams = _.clone(req.query);
		for (var i in params) {
			if (params[i] === undefined) {
				delete params[i];
				delete queryParams[i];
			}
		}

		params = querystring.stringify(_.defaults(params, queryParams));
		return '/keystone/' + req.list.path + (params ? '?' : '') + params;
	};
	
	// Currently download link not supported with API
	var download_link = '/keystone/download/' + req.list.path;
	var downloadParams = {};

	if (req.query.q) {
		downloadParams.q = req.query.q;
	}
	if (req.query.search) {
		downloadParams.search = req.query.search;
	}
	if (req.query.cols) {
		downloadParams.cols = req.query.cols;
	}
	
	downloadParams = querystring.stringify(downloadParams);

	if (downloadParams) {
		download_link += '?' + downloadParams;
	}

	var appName = keystone.get('name') || 'Keystone';

	req.list.helpers = {
		awsUrlGenerator: awsUrlGenerator
	};

	query.exec().then(function(items){
		var newLocals = _.extend(viewLocals, {
			section: keystone.nav.by.list[req.list.key] || {},
			title: appName + ': ' + req.list.plural,
			page: 'list',
			link_to: link_to,
			download_link: download_link,
			list: req.list,
			sort: sort,
			filters: cleanFilters,
			search: req.query.search,
			searchWithRegex: req.query.searchWithRegex,
			columns: columns,
			colPaths: _.pluck(columns, 'path'),
			items: items,
			submitted: req.body || {},
			query: req.query
		});
		
		keystone.render(req, res, 'list', newLocals);
	})
	.catch(function(err){
		req.flash('error', 'Something went wrong... ' + err);
		return res.redirect('/keystone/');
	});
};
