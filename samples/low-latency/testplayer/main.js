var METRIC_INTERVAL = 8000;

var App = function () {
    this.player = null;
    this.controlbar = null;
    this.video = null;
    this.chart = null;
    this.domElements = {
        settings: {},
        metrics: {},
        chart: {}
    }
    this.chartTimeout = null;
    this.chartReportingInterval = 8000;
    this.chartNumberOfEntries = 30;
    this.chartData = {
        playbackTime: 0,
        lastTimeStamp: null
    }
};

App.prototype.init = function () {
    this._setDomElements();
    this._adjustSettingsByUrlParameters();
    this._registerEventHandler();
    this._startIntervalHandler();
    this._setupLineChart();
}

App.prototype._setDomElements = function () {
    this.domElements.settings.targetLatency = document.getElementById('target-latency');
    this.domElements.settings.maxDrift = document.getElementById('max-drift');
    this.domElements.settings.maxCatchupPlaybackRate = document.getElementById('max-catchup-playback-rate');
    this.domElements.settings.minCatchupPlaybackRate = document.getElementById('min-catchup-playback-rate');
    this.domElements.settings.catchupEnabled = document.getElementById('live-catchup-enabled');
    this.domElements.settings.abrAdditionalInsufficientBufferRule = document.getElementById('abr-additional-insufficient')
    this.domElements.settings.abrAdditionalDroppedFramesRule = document.getElementById('abr-additional-dropped');
    this.domElements.settings.abrAdditionalAbandonRequestRule = document.getElementById('abr-additional-abandon');
    this.domElements.settings.abrAdditionalSwitchHistoryRule = document.getElementById('abr-additional-switch');
    this.domElements.settings.targetLatency = document.getElementById('target-latency');
    this.domElements.settings.exportSettingsUrl = document.getElementById('export-settings-url');

    this.domElements.chart.metricChart = document.getElementById('metric-chart');
    this.domElements.chart.enabled = document.getElementById('chart-enabled');
    this.domElements.chart.interval = document.getElementById('chart-interval');
    this.domElements.chart.numberOfEntries = document.getElementById('chart-number-of-entries');

    this.domElements.metrics.latencyTag = document.getElementById('latency-tag');
    this.domElements.metrics.playbackrateTag = document.getElementById('playbackrate-tag');
    this.domElements.metrics.bufferTag = document.getElementById('buffer-tag');
    this.domElements.metrics.sec = document.getElementById('sec');
    this.domElements.metrics.min = document.getElementById('min');
    this.domElements.metrics.videoMaxIndex = document.getElementById('video-max-index');
    this.domElements.metrics.videoIndex = document.getElementById('video-index');
    this.domElements.metrics.videoBitrate = document.getElementById('video-bitrate');
}

App.prototype._load = function () {
    var url;

    if (this.player) {
        this.player.reset();
        this._unregisterDashEventHandler();
        this.chartData.playbackTime = 0;
        this.chartData.lastTimeStamp = null
    }

    url = document.getElementById('manifest').value;

    this.video = document.querySelector('video');
    this.player = dashjs.MediaPlayer().create();
    this._registerDashEventHandler();
    this._applyParameters();
    this.player.initialize(this.video, url, true);
    this.controlbar = new ControlBar(this.player);
    this.controlbar.initialize();
}

App.prototype._applyParameters = function () {

    if (!this.player) {
        return;
    }

    var settings = this._getCurrentSettings();

    this.player.updateSettings({
        streaming: {
            delay: {
                liveDelay: settings.targetLatency
            },
            liveCatchup: {
                enabled: settings.catchupEnabled,
                maxDrift: settings.maxDrift,
                playbackRate: {
                    min: settings.minCatchupPlaybackRate,
                    max: settings.maxCatchupPlaybackRate
                },
                mode: settings.catchupMechanism
            },
            abr: {
                ABRStrategy: settings.abrGeneral,
                additionalAbrRules: {
                    insufficientBufferRule: settings.abrAdditionalInsufficientBufferRule,
                    switchHistoryRule: settings.abrAdditionalSwitchHistoryRule,
                    droppedFramesRule: settings.abrAdditionalDroppedFramesRule,
                    abandonRequestsRule: settings.abrAdditionalAbandonRequestRule
                },
                fetchThroughputCalculationMode: settings.throughputCalculation
            }
        }
    });
}

App.prototype._exportSettings = function () {
    var settings = this._getCurrentSettings();
    var url = document.location.origin + document.location.pathname;

    url += '?';

    for (var [key, value] of Object.entries(settings)) {
        url += '&' + key + '=' + value
    }

    url = encodeURI(url);
    const element = document.createElement('textarea');
    element.value = url;
    document.body.appendChild(element);
    element.select();
    document.execCommand('copy');
    document.body.removeChild(element);

    Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Settings URL copied to clipboard',
        showConfirmButton: false,
        timer: 1500
    })
}

App.prototype._adjustSettingsByUrlParameters = function () {
    var urlSearchParams = new URLSearchParams(window.location.search);
    var params = Object.fromEntries(urlSearchParams.entries());

    if (params) {
        if (params.targetLatency !== undefined) {
            this.domElements.settings.targetLatency.value = parseFloat(params.targetLatency).toFixed(1);
        }
        if (params.maxDrift !== undefined) {
            this.domElements.settings.maxDrift.value = parseFloat(params.maxDrift).toFixed(1);
        }
        if (params.minCatchupPlaybackRate !== undefined) {
            this.domElements.settings.minCatchupPlaybackRate.value = parseFloat(params.minCatchupPlaybackRate).toFixed(2);
        }
        if (params.maxCatchupPlaybackRate !== undefined) {
            this.domElements.settings.maxCatchupPlaybackRate.value = parseFloat(params.maxCatchupPlaybackRate).toFixed(2);
        }
        if (params.abrAdditionalInsufficientBufferRule !== undefined) {
            this.domElements.settings.abrAdditionalInsufficientBufferRule.checked = params.abrAdditionalInsufficientBufferRule === 'true';
        }
        if (params.abrAdditionalAbandonRequestRule !== undefined) {
            this.domElements.settings.abrAdditionalAbandonRequestRule.checked = params.abrAdditionalAbandonRequestRule === 'true';
        }
        if (params.abrAdditionalSwitchHistoryRule !== undefined) {
            this.domElements.settings.abrAdditionalSwitchHistoryRule.checked = params.abrAdditionalSwitchHistoryRule === 'true';
        }
        if (params.abrAdditionalDroppedFramesRule !== undefined) {
            this.domElements.settings.abrAdditionalDroppedFramesRule.checked = params.abrAdditionalDroppedFramesRule === 'true';
        }
        if (params.catchupEnabled !== undefined) {
            this.domElements.settings.catchupEnabled.checked = params.catchupEnabled === 'true';
        }
        if (params.abrGeneral !== undefined) {
            document.getElementById(params.abrGeneral).checked = true;
        }
        if (params.catchupMechanism !== undefined) {
            document.getElementById(params.catchupMechanism).checked = true;
        }
        if (params.throughputCalculation !== undefined) {
            document.getElementById(params.throughputCalculation).checked = true;
        }
    }

}

App.prototype._getCurrentSettings = function () {
    var targetLatency = parseFloat(this.domElements.settings.targetLatency.value, 10);
    var maxDrift = parseFloat(this.domElements.settings.maxDrift.value, 10);
    var minCatchupPlaybackRate = parseFloat(this.domElements.settings.minCatchupPlaybackRate.value, 10);
    var maxCatchupPlaybackRate = parseFloat(this.domElements.settings.maxCatchupPlaybackRate.value, 10);
    var abrAdditionalInsufficientBufferRule = this.domElements.settings.abrAdditionalInsufficientBufferRule.checked;
    var abrAdditionalDroppedFramesRule = this.domElements.settings.abrAdditionalDroppedFramesRule.checked;
    var abrAdditionalAbandonRequestRule = this.domElements.settings.abrAdditionalAbandonRequestRule.checked;
    var abrAdditionalSwitchHistoryRule = this.domElements.settings.abrAdditionalSwitchHistoryRule.checked;
    var catchupEnabled = this.domElements.settings.catchupEnabled.checked;
    var abrGeneral = document.querySelector('input[name="abr-general"]:checked').value;
    var catchupMechanism = document.querySelector('input[name="catchup"]:checked').value;
    var throughputCalculation = document.querySelector('input[name="throughput-calc"]:checked').value;

    return {
        targetLatency,
        maxDrift,
        minCatchupPlaybackRate,
        maxCatchupPlaybackRate,
        abrGeneral,
        abrAdditionalInsufficientBufferRule,
        abrAdditionalDroppedFramesRule,
        abrAdditionalAbandonRequestRule,
        abrAdditionalSwitchHistoryRule,
        catchupMechanism,
        catchupEnabled,
        throughputCalculation
    }
}

App.prototype._setupLineChart = function () {
    var data = {
        datasets: [
            {
                label: 'Live delay',
                borderColor: '#3944bc',
                backgroundColor: '#3944bc',
            },
            {
                label: 'Buffer level',
                borderColor: '#d0312d',
                backgroundColor: '#d0312d',
            },
            {
                label: 'Playback rate',
                borderColor: '#3cb043',
                backgroundColor: '#3cb043',
            }]
    };
    var config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                y: {
                    min: 0,
                    ticks: {
                        stepSize: 0.5
                    },
                    title: {
                        display: true,
                        text: 'Value in Seconds'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Value in Seconds'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Live data',
                    y: {
                        text: 'y-axis'
                    }
                }
            }
        },
    };

    // eslint-disable-next-line no-undef
    this.chart = new Chart(
        this.domElements.chart.metricChart,
        config
    );

    this._enableChart(true);
}

App.prototype._enableChart = function (enabled) {
    if (!enabled && this.chartTimeout) {
        clearTimeout(this.chartTimeout);
        this.chartTimeout = null;
        return;
    }

    if (this.chartTimeout && enabled) {
        return;
    }

    this._updateChartData();

}

App.prototype._updateChartData = function () {
    var self = this;

    this.chartTimeout = setTimeout(function () {
        if (self.player && self.player.isReady()) {
            const data = self.chart.data;
            if (data.datasets.length > 0) {

                if (data.labels.length > self.chartNumberOfEntries) {
                    data.labels.shift();
                }

                if (self.chartData.lastTimeStamp) {
                    self.chartData.playbackTime += Date.now() - self.chartData.lastTimeStamp;
                }

                data.labels.push(parseFloat(self.chartData.playbackTime / 1000).toFixed(3));

                self.chartData.lastTimeStamp = Date.now();

                for (var i = 0; i < data.datasets.length; i++) {
                    if (data.datasets[i].data.length > self.chartNumberOfEntries) {
                        data.datasets[i].data.shift();
                    }
                }
                data.datasets[0].data.push(parseFloat(self.player.getCurrentLiveLatency()).toFixed(2));

                var dashMetrics = self.player.getDashMetrics();
                data.datasets[1].data.push(parseFloat(dashMetrics.getCurrentBufferLevel('video')).toFixed(2));

                data.datasets[2].data.push(parseFloat(self.player.getPlaybackRate()).toFixed(2));

                self.chart.update();
            }
        }
        self._updateChartData();
    }, self.chartReportingInterval)

}

App.prototype._adjustChartSettings = function () {

    if (!isNaN(parseInt(this.domElements.chart.interval.value))) {
        this.chartReportingInterval = parseInt(this.domElements.chart.interval.value);
    }

    if (!isNaN(parseInt(this.domElements.chart.numberOfEntries.value))) {
        this.chartNumberOfEntries = parseInt(this.domElements.chart.numberOfEntries.value);
    }

    this._enableChart(this.domElements.chart.enabled.checked);
}


App.prototype._startIntervalHandler = function () {
    var self = this;
    let count = 0;
    let result = [];
    result.push('Metric Values:' + '\r\n')
    let bitRateArray = [];
    let bufferArray = [];
    let throughputeArray = [];
    let downloadArray = [];
    let segmentSizeArray = [];
    var interval = setInterval(function () {
        if (self.player && self.player.isReady()) {
            var dashMetrics = self.player.getDashMetrics();

            var currentLatency = parseFloat(self.player.getCurrentLiveLatency(), 10);
            self.domElements.metrics.latencyTag.innerHTML = currentLatency + ' secs';

            var currentPlaybackRate = self.player.getPlaybackRate();
            self.domElements.metrics.playbackrateTag.innerHTML = Math.round(currentPlaybackRate * 1000) / 1000;

            var currentBuffer = dashMetrics.getCurrentBufferLevel('video');
            self.domElements.metrics.bufferTag.innerHTML = currentBuffer + ' secs';

            //Bit Rate
            var bitRateInMbps=+self.domElements.metrics.videoBitrate.innerHTML/1000;
            console.log('Bitrate:', bitRateInMbps+'Mbps');
            bitRateArray.push('Bitrate: '+bitRateInMbps + 'Mbps\r\n');

            //Buffer
            console.log('Current Buffer:',self.domElements.metrics.bufferTag.innerHTML);
            bufferArray.push('Current Buffer: ' + self.domElements.metrics.bufferTag.innerHTML + '\r\n');

            //Throughput
            let throughput = self.player.getAverageThroughput('video')/1000;
            console.log('Measured throughput:',throughput+'Mbps');
            throughputeArray.push('Measured throughput: ' + throughput + 'Mbps\r\n');
            
            //Download Time
            const httpObject = dashMetrics.getCurrentHttpRequest('video');
            const segmentTime = Math.abs(httpObject._tfinish.getTime() - httpObject.tresponse.getTime());
            console.log('Segment download time',segmentTime + 'ms');
            downloadArray.push('Segment download time: ' + segmentTime + 'ms' + '\r\n');

            //Segment Size
            console.log('Segment size',httpObject._responseHeaders.split('\r\n')[1].split(' ')[1]+'bytes')
            segmentSizeArray.push('Segment size: ' + httpObject._responseHeaders.split('\r\n')[1].split(' ')[1] + 'bytes\r\n');

            var d = new Date();
            var seconds = d.getSeconds();
            self.domElements.metrics.sec.innerHTML = (seconds < 10 ? '0' : '') + seconds;
            var minutes = d.getMinutes();
            self.domElements.metrics.min.innerHTML = (minutes < 10 ? '0' : '') + minutes + ':';
            count++;
            // 10 mintues = 600 seconds and interval called for every 8 seconds so 600/8 =75
            if(count === 75){
                result.push('.................................................' + '\r\n');
                for(let i = 0; i < bitRateArray.length; i++){
                    result.push(bitRateArray[i]);
                }
                result.push('.................................................' + '\r\n');
                for(let i = 0; i < bufferArray.length; i++){
                    result.push(bufferArray[i]);
                }
                result.push('.................................................' + '\r\n');
                for(let i = 0; i < throughputeArray.length; i++){
                    result.push(throughputeArray[i]);
                }
                result.push('.................................................' + '\r\n');
                for(let i = 0; i < downloadArray.length; i++){
                    result.push(downloadArray[i]);
                }
                result.push('.................................................' + '\r\n');
                for(let i = 0; i < segmentSizeArray.length; i++){
                    result.push(segmentSizeArray[i]);
                }
                result.push('.................................................' + '\r\n');

                var blob = new Blob(result, {type: 'text/plain;charset=utf-8'});
                saveAs(blob, 'metric output result.txt');
                clearInterval(interval);
            }
        }

    }, METRIC_INTERVAL);
}

App.prototype._registerEventHandler = function () {
    var self = this;

    document.getElementById('apply-settings-button').addEventListener('click', function () {
        self._applyParameters();
        Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: 'Settings applied',
            showConfirmButton: false,
            timer: 1500
        })
    })

    document.getElementById('load-button').addEventListener('click', function () {
        self._load();
    })

    document.getElementById('export-settings-button').addEventListener('click', function () {
        self._exportSettings();
    })

    document.getElementById('chart-settings-button').addEventListener('click', function () {
        self._adjustChartSettings();
        Swal.fire({
            position: 'top-end',
            icon: 'success',
            title: 'Settings applied',
            showConfirmButton: false,
            timer: 1500
        })
    })
}

App.prototype._registerDashEventHandler = function () {
    this.player.on(dashjs.MediaPlayer.events.REPRESENTATION_SWITCH, this._onRepresentationSwitch, this);
}

App.prototype._unregisterDashEventHandler = function () {
    this.player.on(dashjs.MediaPlayer.events.REPRESENTATION_SWITCH, this._onRepresentationSwitch, this);
}

App.prototype._onRepresentationSwitch = function (e) {
    try {
        if (e.mediaType === 'video') {
            this.domElements.metrics.videoMaxIndex.innerHTML = e.numberOfRepresentations
            this.domElements.metrics.videoIndex.innerHTML = e.currentRepresentation.index + 1;
            var bitrate = Math.round(e.currentRepresentation.bandwidth / 1000);
            this.domElements.metrics.videoBitrate.innerHTML = bitrate;
        }
    } catch (e) {

    }
}



