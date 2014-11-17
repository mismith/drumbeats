angular.module('firebaseHelper', ['firebase'])

	.service('$firebaseHelper', ['$firebase', function($firebase){
		var self   = this,
			cached = {};
		
		// returns: Reference
		self.$ref = function(){
			var args = Array.prototype.slice.call(arguments);
			if( args[0] != 'constants') args.unshift('data');
			
			var path = 'Ref' + args.join('');
			if(cached[path]) return cached[path];
			
			var $ref = new Firebase('https://ripkit.firebaseio.com/' + (args.join('/') || ''));
			cached[path] = $ref;
			
			return $ref;
		};
		
		// returns: Instance
		self.$inst = function(){
			var args = Array.prototype.slice.call(arguments),
				path = 'Inst' + args.join('');
			if(cached[path]) return cached[path];
			
			var $inst = $firebase(self.$ref.apply(this, arguments));
			cached[path] = $inst;
			
			return $inst;
		};
		
		// returns: Object or Array
		// i.e. if last argument === true, return Array instead of Object
		self.$get = function(){
			var args = Array.prototype.slice.call(arguments),
				type = 'Object';
			
			if(args[args.length - 1] === true){
				type = 'Array';
				args.pop();
			}
			
			// retrieve cached item, if possible
			var path = type + args.join('');
			if(cached[path]) return cached[path];
			
			// retrieve from remote, then cache it for later
			var $get = self.$inst.apply(this, args)['$as'+type]();
			cached[path] = $get;
			
			return $get;
		};
		
		// returns: promise for Object or Array
		self.$load = function(){
			return self.$get.apply(this, arguments).$loaded();
		};
		
		// returns: Instance
		self.$child = function(){
			// @TODO: cache somehow
			
			var args = Array.prototype.slice.call(arguments),
				parent = args.shift();
			
			if(angular.isFunction(parent.$inst)){ // it's a Firebase Object or Array
				parent = parent.$inst();
			}
			if(angular.isFunction(parent.$ref)){ // it's a Firebase Instance
				parent = parent.$ref();
			}
			if(angular.isFunction(parent.child)){ // it's a Firebase Reference
				return $firebase(parent.child(args.join('/')));
			}
			return parent; // fallback to parent
		};
		
		
		self.$intersect = function(keysPath, valuesPath){
			// @TODO: cache somehow
			
			return $firebase(Firebase.util.intersection(self.$ref(keysPath), self.$ref(valuesPath))).$asArray();
		};
		
		return self;
	}]);