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
	}])
	
	.controller('BeatCtrl', ["$scope", "$rootScope", "$timeout", function($scope, $rootScope, $timeout){
		$scope.beat = {
			name: 'Beginner',
			
			// time signature
			beatsPerBar: 4,
			beatUnit: 16,
			barsPerMeasure: 2,
			
			// data
			channels: [
				{
					name: 'Bass',
					notes: [3, 7, 11, 15],
				},
				{
					name: 'HiHat',
					notes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
				},
				{
					name: 'Snare',
					notes: [1, 5, 9, 13],
				},
				{
					name: 'Ride',
					//notes: [7],
				},
				{
					name: 'Crash',
					//notes: [17],
				},
				{
					name: 'HiTom',
					//notes: [16.25],
				},
				{
					name: 'LoTom',
					//notes: [16.5],
				},
				{
					name: 'FloorTom',
					//notes: [16.75],
				},
			],
		};
		
		// timing
		var beatsPerMeasure = function(beat){
			return beat.beatsPerBar * beat.barsPerMeasure;
		};
		var setSpots = function(beat){
			$scope.spots = [];
			for(var i = 1; i < beatsPerMeasure(beat) + 1; i += beat.beatsPerBar/beat.beatUnit) $scope.spots.push(i);
			//console.log($scope.spots);
		}
		setSpots($scope.beat);
		
		var setGuides = function(beat){
			$scope.guides = [];
			for(var i = 1; i < beatsPerMeasure(beat) + 1; i += beat.beatsPerBar/beat.beatUnit) $scope.guides.push((i - 1) % beat.beatsPerBar ? -i : i);
			//console.log($scope.guides);
		}
		setGuides($scope.beat);
		
		$scope.$watch('beat.beatsPerBar', function(){
			setSpots($scope.beat);
			setGuides($scope.beat);
		});
		$scope.$watch('beat.beatUnit', function(){
			setSpots($scope.beat);
			setGuides($scope.beat);
		});
		
		
		var getLength = function(beat){
			// get last set note index
			var max = 0;
			angular.forEach(beat.channels, function(channel){
				max = Math.max(max, channel.notes ? Math.max.apply(null, channel.notes) - 1 : 0);
			});
			
			// round it up to the nearest multiple of beatsPerMeasure
			var period = beatsPerMeasure(beat);
			max = max - (max % period) + (max % period > 0 && period);
			
			//console.log(max);
			return max;
		};
		getLength($scope.beat);
		
		$scope.getMeasures = function(beat, editing){
			var measures = [];
			// if editing enabled, + 1 to keep an empty period at the bottom to add new stuff
			for(var i = 1; i <= getLength(beat) / beatsPerMeasure(beat) + (editing ? 1 : 0); i++){
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
					var elapsed = now() - $marker.$start;
					period = 1000 * 60 / $marker.$bpm * beatsPerMeasure($scope.beat);
					$marker.measure = Math.floor(elapsed / period) + 1;
					$marker.position = Math.min(Math.max(0, (elapsed % period) / period), 1);
				});
				
				if($marker.$playing) requestAnimationFrame($marker.$refresh);
			},
		};
		$marker.play();
		
		// display
		$scope.progress = function(note, beat, noAdjust){
			// subtract 1 to go from 1-based-index to 0-based
			return (Math.abs(note) - 1) % beatsPerMeasure(beat) / beatsPerMeasure(beat);
		};
		$scope.lyric = function(guide, beat, returnType){
			var mod = (Math.abs(guide) - 1) % 1;
			//if(returnType) return parseInt(mod * beat.beatsPerBar);
			
			if(mod == 0){
				return returnType ? 'note' : (Math.abs(guide) - 1) % beat.beatsPerBar + 1;
			}else if(mod <= 1/4){
				return 'e';
			}else if(2/3 <= mod){
				return 'a';
			}else{
				return returnType ? 'and' : '&';
			}
		};
		
		// editing
		$scope.addNote = function(channel, measure, spot){
			if( ! channel.notes) channel.notes = [];
			
			var note = spot + (measure - 1) * beatsPerMeasure($scope.beat);
			
			channel.notes.push(note);
			
			//console.log(spot, measure, note);
		};
		$scope.alterNote = function(channel, note){
			var i = channel.notes.indexOf(note);
			
			//console.log(i, note);
			if(i >= 0) channel.notes[i] = -channel.notes[i];
		};
		$scope.removeNote = function(channel, note){
			if( ! channel.notes) channel.notes = [];
			
			var i = channel.notes.indexOf(note);
			if(i >= 0) channel.notes.splice(i, 1);
		};
		$scope.shiftNotes = function(amount){
			if( ! amount) return;
			
			angular.forEach($scope.beat.channels, function(channel){
				angular.forEach(channel.notes, function(note, i){
					channel.notes[i] += amount;
				});
			});
			//console.log($scope.beat);
		};
		
	}])
	
	.filter('filterNotesByMeasure', function(){
		return function(array, beat, measure){
			if( ! array) return array;
			
			var min = (measure - 1) * beat.beatsPerBar * beat.barsPerMeasure,
				max = (measure - 0) * beat.beatsPerBar * beat.barsPerMeasure;
			
			return array.filter(function(v){
				return min + 1 < v && v < max + 1; // + 1's to account for 1-based index
			});
		};
	})
	
	
	
	
	// @TODO: clicking 0/first spot doesn't add a note properly
	// @TODO: marker.position resetting/wrapping