/**
 * Copyright 2013,2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
    "use strict";
    var fs = require('fs');

    var powerKeysMapping = {
            POWER_SUPPLY_NAME: {name: "name", divider: null},
            POWER_SUPPLY_MODEL_NAME: {name: "model", divider: null},
            POWER_SUPPLY_STATUS: {name: "status", divider: null},
            POWER_SUPPLY_PRESENT: {name: "present", divider: 1},
            POWER_SUPPLY_ONLINE: {name: "online", divider: 1},
            POWER_SUPPLY_HEALTH: {name: "health", divider: null},
            POWER_SUPPLY_TECHNOLOGY: {name: "technology", divider: null},
            POWER_SUPPLY_VOLTAGE_MAX_DESIGN: {name: "voltageMaxDesign", divider: 1000},
            POWER_SUPPLY_VOLTAGE_MIN_DESIGN: {name: "voltageMinDesign", divider: 1000},
            POWER_SUPPLY_VOLTAGE_NOW: {name: "voltageNow", divider: 1000},
            POWER_SUPPLY_CURRENT_NOW: {name: "currentNow", divider: 1000},
            POWER_SUPPLY_ENERGY_FULL_DESIGN: {name: "energyFullDesign", divider: 1},
            POWER_SUPPLY_CAPACITY: {name: "capacity", divider: 1},
            POWER_SUPPLY_TEMP: {name: "temp", divider: 1}
        };

    function PowerStatusIn(n) {
        RED.nodes.createNode(this, n);
        this.updateInterval = n.updateInterval || 1000;
        this.sourceType = n.sourceType || "ac";
        this.dataType = n.dataType || "online";
        this.outputOn = n.outputOn;
        this.updateInterval = n.updateInterval;
        this.debounce = n.debounce;
        this._fileToRead = "/sys/class/power_supply/" + this.sourceType + "/" + this.dataType;
        this._reading = false;
        this._lastValue = null;

        var node = this;

        this.log(JSON.stringify(this));

        var timerCallback = function () {
            if (node._reading <= 0) {
                node._reading = 1;
                fs.readFile(node._fileToRead, "utf-8", function(err, data) {
                    if (err) {
                        node.error("Read error " + node._fileToRead, err);
                        node._reading = 10;
                    } else {
                        node._reading = 0;
                    }
                    if (node._lastValue != data) {
                        if (node.dataType == "uevent") {
                            var lines = data.split("\n");
                            var payload = {};
                            for (var i = 0; i < lines.length; i++) {
                                var entry = lines[i].split("=");
                                var key = powerKeysMapping[entry[0]];
                                if (key == undefined) {
                                    //node.log("key is undefined " + entry[0]);
                                    continue;
                                }
                                var val = entry[1];
                                if (key.divider != null) {
                                    val = parseInt(val) / key.divider;
                                }
                                payload[key.name] = val;
                            }
                            node.send({payload: payload});
                        } else {
                            node.send({payload: data});
                        }
                    }
                    node._lastValue = data;
                });
            } else {
                node._reading--;
            }
        };

        this._interval = setInterval(timerCallback, this.updateInterval);

        this.on("close", function () {
            clearInterval(this._interval);
        });
    }

    RED.nodes.registerType("powerStatus in", PowerStatusIn);

    function LedOut(n) {
        RED.nodes.createNode(this, n);
        this.updateInterval = n.updateInterval || 1000;
        this.device = n.device || {};
        this.mode = n.mode || "default-on";

        var node = this;

        this.on("input", function(msg) {
            var dev = 'green_led';
            //var dev = 'green:ph24:led1';
            //console.log('BPI: LED node.device:' + node.device);
            if (node.device != undefined) {
              dev = node.device;
            }
            var device = "/sys/class/leds/" + dev + "/trigger";
            var status = msg.payload == 1 || msg.payload == true;
            //console.log('BPI: LED ' + device + " : " + node.mode);
            var mode = "none";
            if (status) {
              mode = node.mode;
              node.status({fill:"green",shape:"ring",text: mode});
            }
            else {
              node.status({fill:"red",shape:"ring",text: mode});
            }
            fs.writeFile(device, mode, function(err) {
                if (err) { 
                   node.error("Set led status error", err);
                   node.status({fill:"red",shape:"ring",text: mode});
                }
            });
        });

        this.on("close", function () {
            clearInterval(this._interval);
        });
    }

    RED.nodes.registerType("LedStatus out", LedOut);
};
