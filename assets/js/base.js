'use strict';

angular.module('drumbeats', ['firebaseHelper']).config(["$firebaseHelperProvider", function ($firebaseHelperProvider) {
	$firebaseHelperProvider.namespace('mismith');
	$firebaseHelperProvider.root('drumbeats');
}]).controller('AppCtrl', ["$rootScope", function ($rootScope) {
	$rootScope.console = console;
}]).controller('BeatCtrl', ["$scope", "$rootScope", "$firebaseHelper", "$timeout", function ($scope, $rootScope, $firebaseHelper, $timeout) {
	$scope.channels = $firebaseHelper.array('channels');
	$scope.beats = $firebaseHelper.object('beats');

	$scope.selectedBeat = 0;
	$scope.beats.$loaded().then(function () {
		$scope.$watch('selectedBeat', function (v) {
			$scope.beat = $scope.beats[v] || {};
		});
		$scope.$watchCollection('beat', function () {
			$scope.guides = incrementArray($scope.beat);
		});
	});

	// timing
	var beatsPerLine = function beatsPerLine(beat) {
		if (!beat) return 0;

		return beat.beatsPerBar * beat.barsPerLine;
	};
	var beatSubunit = function beatSubunit(beat) {
		if (!beat || !beat.beatsPerBar) return 0;

		if (beat.beatsPerBar % 4 == 0) {
			return 1 / 4;
		} else if (beat.beatsPerBar % 3 == 0) {
			return 1 / 3;
		}
		return 1 / 2;
	};

	var incrementArray = function incrementArray(beat) {
		if (!beat) return [];

		var array = [];
		var subunit = beatSubunit(beat);
		for (var i = 0; i < beat.barsPerLine / beatSubunit(beat) * beat.beatsPerBar; i++) {
			var item = i * subunit + 1;
			array.push(item);
		}
		//console.log(array);
		return array;
	};

	// math
	var getLength = function getLength(beat) {
		if (!beat || !beat.channels) return 0;
		// get last set note index
		var max = 0;
		angular.forEach(beat.channels, function (channel) {
			max = Math.max(max, channel ? Math.max.apply(null, channel) - 1 : 0);
		});

		// round it up to the nearest multiple of beatsPerLine
		var period = beatsPerLine(beat);
		max = max - max % period + (max % period > 0 && period);

		//console.log(max);
		return max;
	};
	//getLength($scope.beat);

	$scope.getMeasures = function (beat) {
		var measures = [];
		// if editing enabled, + 1 to keep an empty period at the bottom to add new stuff
		for (var i = 1; i <= getLength(beat) / beatsPerLine(beat) + (editing ? 1 : 0); i++) {
			measures.push(i);
		}
		//console.log(measures);
		return measures;
	};

	var now = function now() {
		return +new Date();
	};
	var $marker = $rootScope.$marker = {
		measure: 1,
		position: 0,
		$bpm: 90,
		bpm: function bpm(set) {
			if (set) $marker.$bpm = set;
			return $marker.$bpm;
		},
		$start: now(),
		$playing: false,
		play: function play(bpm) {
			if (bpm) $marker.bpm(bpm);

			$marker.$playing = true;
			$marker.$start = now() - ($marker.$paused || 0);

			requestAnimationFrame($marker.$refresh);
		},
		pause: function pause() {
			$marker.$playing = false;
			$marker.$paused = now() - $marker.$start;
		},
		stop: function stop() {
			$marker.$start = now() + 1000;
			$marker.$playing = false;
			$marker.$paused = 0;
		},
		$refresh: function $refresh() {
			$scope.$apply(function () {
				var elapsed = now() - $marker.$start,
				    period = 1000 * 60 / $marker.$bpm * beatsPerLine($scope.beat);
				$marker.position = Math.min(Math.max(0, elapsed % period / period), 1);

				var measuresCount = $scope.getMeasures($scope.beat, $scope.editing).length,
				    measure = Math.floor(elapsed / period) + 1;
				$marker.measure = measure > measuresCount ? (measure + 1) % measuresCount + 1 : measure;
			});

			if ($marker.$playing) requestAnimationFrame($marker.$refresh);
		}
	};
	$marker.play();

	// display
	$scope.progress = function (note, beat, noAdjust) {
		// subtract 1 to go from 1-based-index to 0-based
		return (Math.abs(note) - 1) % beatsPerLine(beat) / beatsPerLine(beat);
	};
	$scope.lyric = function (guide, beat, returnType) {
		var subunit = beatSubunit(beat),
		    remainder = guide - parseInt(guide);

		if (0 < remainder && remainder <= 101 / 400) {
			return 'e';
		} else if (99 / 300 <= remainder && remainder <= 101 / 200) {
			return '&';
		} else if (199 / 300 <= remainder) {
			return 'a';
		} else {
			return (guide - 1) % beat.beatsPerBar + 1;
		}
	};

	// editing
	$scope.addNote = function (beat, channel, measure, spot) {
		if (!beat) beat = {};
		if (!beat.channels) beat.channels = {};
		if (!beat.channels[channel]) beat.channels[channel] = [];

		var note = spot + (measure - 1) * beatsPerLine($scope.beat);

		beat.channels[channel].push(note);

		console.log(beat, channel, measure, spot, note);
		return note;
	};
	$scope.alterNote = function (channel, note) {
		var i = channel.indexOf(note);

		//console.log(i, note);
		if (i >= 0) channel[i] = -channel[i];
	};
	$scope.removeNote = function (channel, note) {
		if (!channel) channel = [];

		var i = channel.indexOf(note);
		if (i >= 0) channel.splice(i, 1);
	};

	// CRUD
	var editing = false;
	$scope.editing = function (set) {
		if (set !== undefined) editing = set;
		return editing;
	};
	$scope.reset = function () {
		$scope.selectedBeat = 0;
	};
	$scope['delete'] = function () {
		$scope.beats.$inst().$remove($scope.selectedBeat).then($scope.reset);
	};
	$scope.save = function () {
		if ($scope.selectedBeat) {
			// update
			$scope.beats.$inst().$update($scope.selectedBeat, $scope.beat);
		} else {
			// create
			$scope.beats.$inst().$push($scope.beat).then(function (snapshot) {
				$scope.selectedBeat = snapshot.key();
			});
		}
	};
}]).filter('filterNotesByMeasure', function () {
	return function (array, beat, measure) {
		if (!array) return array;

		var min = (measure - 1) * beat.beatsPerBar * beat.barsPerLine,
		    max = (measure - 0) * beat.beatsPerBar * beat.barsPerLine;

		return array.filter(function (v) {
			return min + 1 <= v && v < max + 1; // + 1's to account for 1-based index
		});
	};
}).directive('ngResize', ["$window", function ($window) {
	return function (scope, element, attrs) {
		var resize = function resize(e) {
			scope.$eval(attrs.ngResize, {
				$width: element[0].offsetWidth,
				$height: element[0].offsetHeight,
				$vw: $window.innerWidth,
				$vh: $window.innerHeight,
				$event: e
			});
		};
		angular.element($window).on('resize', resize).on('load', resize);
	};
}]);