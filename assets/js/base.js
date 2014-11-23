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
angular.module('drumbeats', ['firebase', 'firebaseHelper'])
	
	.controller('AppCtrl', ["$scope", "$rootScope", "$firebaseHelper", function($scope, $rootScope, $firebaseHelper){
		$rootScope.console = console;
		
		$rootScope.editing = false;
	}])
	
	.controller('BeatCtrl', ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout){
		$scope.$channels = [
			{
				'.priority': 1.0,
				$id: 'bass',
				name: 'Bass',
			},
			{
				'.priority': 2.0,
				$id: 'hihat',
				name: 'HiHat',
			},
			{
				'.priority': 3.0,
				$id: 'snare',
				name: 'Snare',
			},
			{
				'.priority': 4.0,
				$id: 'ride',
				name: 'Ride',
			},
			{
				'.priority': 5.0,
				$id: 'crash',
				name: 'Crash',
			},
			{
				'.priority': 6.0,
				$id: 'hitom',
				name: 'Hi Tom',
			},
			{
				'.priority': 7.0,
				$id: 'lotom',
				name: 'Lo Tom',
			},
			{
				'.priority': 8.0,
				$id: 'floortom',
				name: 'Floor Tom',
			},
		];
		$scope.beat = {
			name: 'Beginner',
			
			// timing + display
			beatsPerBar: 4,
			barsPerLine: 2,
			
			// data
			channels: {
				bass:  [3, 7, 11, 15],
				hihat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
				snare: [1, 5, 9, 13],
			},
		};
		$scope.beats = [
			$scope.beat,
		];
		
		// timing
		var beatsPerLine = function(beat){
			return beat.beatsPerBar * beat.barsPerLine;
		};
		var beatSubunit = function(beat){
			if(beat.beatsPerBar % 4 == 0){
				return 1/4;
			}else if(beat.beatsPerBar % 3 == 0){
				return 1/3;
			}
			return 1/2;
		};
		
		var incrementArray = function(beat){
			var array = [];
			var increment = beatSubunit(beat);
			for(var i = 0; i < beat.barsPerLine / beatSubunit(beat) * beat.beatsPerBar; i++){
				var item = i * increment + 1;
				array.push(item);
			}
			//console.log(array);
			return array;
		}
		$scope.$watchCollection('beat', function(){
			$scope.guides = incrementArray($scope.beat);
		});
		
		// math
		var getLength = function(beat){
			// get last set note index
			var max = 0;
			angular.forEach(beat.channels, function(channel){
				max = Math.max(max, channel ? Math.max.apply(null, channel) - 1 : 0);
			});
			
			// round it up to the nearest multiple of beatsPerLine
			var period = beatsPerLine(beat);
			max = max - (max % period) + (max % period > 0 && period);
			
			//console.log(max);
			return max;
		};
		//getLength($scope.beat);
		
		$scope.getMeasures = function(beat, editing){
			var measures = [];
			// if editing enabled, + 1 to keep an empty period at the bottom to add new stuff
			for(var i = 1; i <= getLength(beat) / beatsPerLine(beat) + (editing ? 1 : 0); i++){
				measures.push(i);
			}
			//console.log(measures);
			return measures;
		};
		
		
		var now = function(){ return +new Date; };
		var $marker = $rootScope.$marker = {
			measure: 1,
			position: 0,
			$bpm: 90,
			bpm: function(set){
				if(set) $marker.$bpm = set;
				return $marker.$bpm;
			},
			$start: now(),
			$playing: false,
			play: function(bpm){
				if(bpm) $marker.bpm(bpm);
				
				$marker.$playing = true;
				$marker.$start = now() - ($marker.$paused || 0);
				
				requestAnimationFrame($marker.$refresh);
			},
			pause: function(){
				$marker.$playing = false;
				$marker.$paused = now() - $marker.$start;
			},
			stop: function(){
				$marker.$start = now() + 1000;
				$marker.$playing = false;
				$marker.$paused = 0;
			},
			$refresh: function(){
				$scope.$apply(function(){
					var elapsed = now() - $marker.$start,
						period = 1000 * 60 / $marker.$bpm * beatsPerLine($scope.beat);
					$marker.position = Math.min(Math.max(0, (elapsed % period) / period), 1);
					
					var measuresCount = $scope.getMeasures($scope.beat, $scope.editing).length,
						measure = Math.floor(elapsed / period) + 1;
					$marker.measure = measure > measuresCount ? ((measure + 1) % measuresCount) + 1 : measure;
				});
				
				if($marker.$playing) requestAnimationFrame($marker.$refresh);
			},
		};
		$marker.play();
		
		// display
		$scope.progress = function(note, beat, noAdjust){
			// subtract 1 to go from 1-based-index to 0-based
			return ((Math.abs(note) - 1) % beatsPerLine(beat)) / beatsPerLine(beat);
		};
		$scope.lyric = function(guide, beat, returnType){
			var subunit   = beatSubunit(beat),
				remainder = (guide - parseInt(guide));
			
			if(0 < remainder && remainder <= 101/400){
				return 'e';
			}else if(99/300 <= remainder && remainder <= 101/200){
				return '&';
			}else if(199/300 <= remainder){
				return 'a';
			}else{
				return (guide - 1) % beat.beatsPerBar + 1;
			}
		};
		
		// editing
		$scope.addNote = function(channel, measure, spot){
			if( ! channel) channel = [];
			
			var note = spot + (measure - 1) * beatsPerLine($scope.beat);
			
			channel.push(note);
			
			//console.log(spot, measure, note);
		};
		$scope.alterNote = function(channel, note){
			var i = channel.indexOf(note);
			
			//console.log(i, note);
			if(i >= 0) channel[i] = -channel[i];
		};
		$scope.removeNote = function(channel, note){
			if( ! channel) channel = [];
			
			var i = channel.indexOf(note);
			if(i >= 0) channel.splice(i, 1);
		};
/*
		$scope.shiftNotes = function(amount){
			if( ! amount) return;
			
			angular.forEach($scope.beat.channels, function(channel){
				angular.forEach(channel, function(note, i){
					channel[i] += amount;
				});
			});
			//console.log($scope.beat);
		};
*/
		
	}])
	
	.filter('filterNotesByMeasure', function(){
		return function(array, beat, measure){
			if( ! array) return array;
			
			var min = (measure - 1) * beat.beatsPerBar * beat.barsPerLine,
				max = (measure - 0) * beat.beatsPerBar * beat.barsPerLine;
			
			return array.filter(function(v){
				return min + 1 <= v && v < max + 1; // + 1's to account for 1-based index
			});
		};
	})
	
	.directive('ngResize', ["$window", function($window){
		return function(scope, element, attrs){
			var resize = function(e){
				scope.$eval(attrs.ngResize, {
					$width:  element[0].offsetWidth,
					$height: element[0].offsetHeight,
					$vw:     $window.innerWidth,
					$vh:     $window.innerHeight,
					$event:  e,
				});
			};
			angular.element($window)
				.on('resize', resize)
				.on('load', resize);
		};
	}])