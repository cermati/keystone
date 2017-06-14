/**
 * Gets a special Query object that will paginate documents in the list
 *
 * Example:
 *     list.paginate({
 *         page: 1,
 *         perPage: 100,
 *         maxPages: 10
 *     }).exec(function(err, results) {
 *         // do something
 *     });
 *
 * @param {Object} options
 * @param {Function} callback (optional)
 */

var _ = require('lodash');
var Bluebird = require('bluebird');
var superagent = Bluebird.promisifyAll(require ('superagent'));

function paginate (options) {
	
	var list = this;
	
	var currentPage = Number(options.page) || 1;
	var resultsPerPage = Number(options.perPage) || 50;
	var maxPages = Number(options.maxPages) || 10;
	var skip = (currentPage - 1) * resultsPerPage;
	
	list.pagination = { maxPages: maxPages };
	
	var model = {
		_url: options.apiDetails.read.endpoint,
		_method: options.apiDetails.read.method,
		_params: [],
		_url_params_builder: function(){
			if (options.apiDetails.read.params){
				var param = options.apiDetails.read.params;
				if (param.searchByField) {

					var searchQuery = (_.size(options.filters['$or']))? options.filters['$or'][0] : {};
					_.forEach(searchQuery,function(value,key){
						model._params = _.union(model._params, [_.toString(key+'='+_.replace(value,/ /g,'%20'))]);
					});
					
					var searchQueryRegex = (_.size(options.filters)) ? options.filters : {};
					_.forEach(searchQueryRegex,function(value,key){
						debugger;
						if (key!='$or'){
							if (value instanceof RegExp) model._params = _.union(model._params, [_.toString(key+'='+_.replace(value.source,/ /g,'%20'))]);	
							else {
								if (value instanceof Object){
									_.forEach(value,function(value,keyObj){
										var tempValue = null;
										switch (keyObj){
											case '$ne':
												tempValue = !value;
												break;
										}
										if (tempValue!=null) model._params = _.union(model._params, [_.toString(key+'='+_.replace(tempValue,/ /g,'%20'))]);
									});
								}
								else model._params = _.union(model._params, [_.toString(key+'='+_.replace(value,/ /g,'%20'))]);
								
							}
						}
					});
				}
				if (param.limit) this._params = _.union(model._params, [_.toString(param.limit+'='+resultsPerPage)]);
				if (param.offset) this._params = _.union(model._params, [_.toString(param.offset+'='+skip)]);
			}
		},
		exec: function(err){
			this._url_params_builder();
			var s = superagent.get(this._url);

			if (_.size(model._params)){
				_.forEach(model._params, function(param){
					s=s.query(param);
				})

			}


			return s.endAsync()
				.then(function(res){

					var responseBody = res.body;
					_.forEach(responseBody.results,function(item){
						item.get = function(colName){
							return this[colName];
						}
					});

					var items = {
						total: options.apiDetails.read.countResponseData(responseBody),
						results: options.apiDetails.read.getResponseData(responseBody),
						currentPage: currentPage,
						totalPages: _.ceil(responseBody.total/resultsPerPage),
						pages: [],
						previous: (currentPage==1)?false:true,
						next: (currentPage+1<=this.totalPages)?currentPage+1:currentPage,
						first: (currentPage-1)*resultsPerPage+1,
						last: currentPage*resultsPerPage,
					}

					for(var i=1; i<= items.totalPages ; i++){
						items.pages=_.union(items.pages,[i]);
					}

					return items;
				});
		}
	};

	return model;
}

module.exports = paginate;
