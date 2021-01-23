var app = new Vue({
    el: '#app',
    data: {
        cnt: 0,
        season: season,
        gw: gw,
        next_gw: next_gw,
        date: date,
        now_dt: undefined,
        listdates: listdates,
        is_active: is_active,
        active_gw: active_gw,
        gw_fixture: undefined,
        team_id: "-1",
        team_info: undefined,
        using_last_gw_team: false,
        team_data: undefined,
        el_data: undefined,
        xp_data: undefined,
        rp_data: undefined,
        ownership_source: "Official FPL API",
        available_sources: ["Official FPL API"],
        sample_data: undefined,
        // selected_game: undefined
        modal_selected_game: undefined
    },
    beforeMount: function() {
        this.initEmptyData();
    },
    watch: {
        team_data: function(old_value, new_value) {
            refresh_all_graphs();
        },
        ownership_source: function(old_value, new_value) {
            refresh_all_graphs();
        },
        sample_data: function(old_value, new_value) {
            refresh_all_graphs();
        },
        xp_data: function(old_value, new_value) {
            refresh_all_graphs();
        },
        rp_data: function(old_value, new_value) {
            refresh_all_graphs();
        },
        gw_fixture: function(old_value, new_value) {
            refresh_all_graphs();
        },
    },
    computed: {
        valid_team_id() { return this.team_id == -1 ? "Click to enter" : this.team_id },
        is_ready() { return this.team_id == -1 || this.team_data == undefined || this.team_data.length == 0 ? false : true },
        is_rp_ready() { return this.rp_data && this.rp_data.length != 0 },
        is_fixture_ready() { return this.gw_fixture && this.gw_fixture.length != 0 },
        seasongwdate: {
            get: function() {
                return this.season + " / " + this.gw + " / " + this.date;
            },
            set: function(value) {
                let v = value.split(' / ');
                this.season = v[0];
                this.gw = v[1];
                this.date = v[2];
                app_initialize();
            }
        },
        is_using_sample() {
            return this.ownership_source !== "Official FPL API";
        },
        ownership_data() {
            return get_ownership_by_type(this.ownership_source, this.el_data, this.sample_data);
        },
        ownership_by_id() {
            const ownership = this.ownership_data;
            return Object.fromEntries(ownership.map(i => [i.id, i]))
        },
        el_by_id() {
            if (this.el_data == undefined) { return undefined; }
            return Object.fromEntries(this.el_data.map(i => [i.id, i]));
        },
        xp_by_id() {
            if (this.xp_data == undefined) { return undefined; }
            return Object.fromEntries(this.xp_data.map(i => [i.player_id, i]));
        },
        rp_by_id() {
            if (this.rp_data == undefined) { return undefined; }
            return Object.fromEntries(this.rp_data.map(i => [i.id, i]));
        },
        current_team_id: {
            get() {
                if (this.team_id == "-1") {
                    return "";
                }
                return this.team_id;
            },
            set(v) {}
        },
        gameweek_info() {
            if (this.gw_fixture.length == 0) { return {} }
            let fixture = this.gw_fixture;
            let gw_info = {};
            gw_info.start_dt = fixture[0].start_dt;
            gw_info.end_dt = fixture[fixture.length - 1].end_dt;
            gw_info.channels = Math.max(...fixture.map(i => i.order));
            return gw_info;
        },
        grouped_xp_data() {
            let pts = _.cloneDeep(this.xp_data);
            let pts_grouped = _(pts).groupBy('player_id').values().map((group) => ({...group[0], qty: group.length, event_list: group.map(k => parseInt(k.event_id)) })).value();
            return pts_grouped;
        },
        gameweek_games_with_metadata() {

            const xp_data = this.grouped_xp_data;
            const rp_data = this.rp_data;
            const team_data = this.team_data;

            const fixture_data = this.gw_fixture;
            const ownership_vals = this.ownership_by_id;

            let picks = team_data.picks;
            if (!this.is_ready) { picks = []; }
            let picks_by_id = Object.fromEntries(picks.map(i => [i.element, i]));

            let xp_by_id = Object.fromEntries(xp_data.map(i => [i.player_id, i]));
            let rp_by_id = Object.fromEntries(rp_data.map(i => [i.id, i]));
            let cloned_fixture = _.cloneDeep(fixture_data);

            // TODO: Assign expected totals and realized totals to every game
            cloned_fixture.forEach((game) => {
                game.game_string = this.game_label(game);
                let players_in_this_game = xp_data.filter(i => i.event_list.includes(game.id)).map(i => i.player_id);
                game.player_list = players_in_this_game;
                let player_with_data = players_in_this_game.map(i => Object.fromEntries([
                    ['id', parseInt(i)]
                ]));
                player_with_data.forEach((e) => {
                    let player_xp = xp_by_id[e.id];
                    e.xp = player_xp.points_md / Math.max(player_xp.event_list.length, 1);

                    if (this.is_rp_ready) {
                        let find = rp_by_id[e.id].explain.find(i => i.fixture == game.id);
                        if (find == undefined) {
                            e.rp_detail = [];
                            e.rp = 0;
                        } else {
                            e.rp_detail = rp_by_id[e.id].explain.find(i => i.fixture == game.id).stats.map(i => [i.identifier, i.points, i.value]);
                            e.rp = getSum(e.rp_detail.map(i => i[1]));
                        }
                    } else {
                        e.rp_detail = [];
                        e.rp = 0;
                    }

                    let player_match = picks_by_id[e.id];
                    e.ownership = this.is_using_sample ? ownership_vals[e.id].effective_ownership / 100 : ownership_vals[e.id].selected_by_percent / 100;
                    e.multiplier = player_match ? player_match.multiplier : 0;
                    e.xp_net = (e.multiplier - e.ownership) * e.xp;
                    e.rp_net = (e.multiplier - e.ownership) * e.rp;


                })
                game.player_details = player_with_data;
                game.xp_sum = getSum(game.player_details.map(i => i.xp));
                game.rp_sum = getSum(game.player_details.map(i => i.rp));
                game.xp_team_gain = getSum(game.player_details.filter(i => i.multiplier > 0).map(i => i.xp_net));
                game.xp_team_loss = getSum(game.player_details.filter(i => i.multiplier == 0).map(i => i.xp_net));
                game.rp_team_gain = getSum(game.player_details.filter(i => i.multiplier > 0).map(i => i.rp_net));
                game.rp_team_loss = getSum(game.player_details.filter(i => i.multiplier == 0).map(i => i.rp_net));

            })
            return cloned_fixture;
        },
        get_graph_checkpoints() {

            const gw_info = this.gameweek_info;
            if (_.isEmpty(gw_info)) { return [] }

            let cloned_fixture = this.gameweek_games_with_metadata;

            let all_discrete_events = cloned_fixture.map(i => [{ type: 'start', dt: i.start_dt, game: i }, { type: 'end', dt: i.end_dt, game: i }]).flat();
            all_discrete_events.push({ type: 'now', dt: new Date(app.now_dt), game: undefined })
            all_discrete_events.sort((a, b) => { return a.dt - b.dt });
            all_discrete_events = _.cloneDeep(all_discrete_events)

            // Initial event
            let team_checkpoints = [];
            let current_status = {
                time: modify_time(gw_info.start_dt.getTime(), -2),
                expected: { points: 0, gain: 0, loss: 0, diff: 0 },
                realized: { points: 0, gain: 0, loss: 0, diff: 0 },
                average: { expected: 0, realized: 0 },
                active_events: [],
                finished_events: [],
                discrete_order: 0,
                reason: "init"
            }
            team_checkpoints.push(_.cloneDeep(current_status));

            // for each ...
            all_discrete_events.forEach((event) => {
                let current_time = event.dt.getTime()
                    // let existing_entry = team_checkpoints.find(i => i.time == current_time)
                let target_event = current_status;

                target_event.discrete_order += 1;
                target_event = current_status;

                // target_event = current_status;
                target_event.reason = event.type;
                target_event.time = event.dt.getTime();
                target_event.trigger = event;

                if (event.type == "start") {
                    target_event.active_events.push(event)
                } else if (event.type == "end") {
                    target_event.active_events = target_event.active_events.filter(i => i.game.id !== event.game.id);
                    target_event.finished_events.push(event);
                }
                let values = this.get_points_for_time(event.type, current_time, target_event.active_events, target_event.finished_events);
                target_event.expected.points = values.xp_total;
                target_event.realized.points = values.rp_total;
                target_event.expected.gain = values.xp_gain;
                target_event.realized.gain = values.rp_gain;
                target_event.expected.loss = values.xp_loss;
                target_event.realized.loss = values.rp_loss;
                target_event.expected.diff = values.xp_diff;
                target_event.realized.diff = values.rp_diff;
                target_event.average.expected = values.avg_expected;
                target_event.average.realized = values.avg_realized;

                let existing_entry = team_checkpoints.find(i => i.time == current_time)
                if (!existing_entry) {
                    team_checkpoints.push(_.cloneDeep(target_event))
                } else {
                    existing_entry = _.cloneDeep(target_event)
                }

            });

            current_status.reason = "final";
            current_status.time = modify_time(gw_info.end_dt.getTime(), 2);
            current_status.discrete_order += 1;
            team_checkpoints.push(_.cloneDeep(current_status));

            return team_checkpoints;

        },
        selected_game_info() {
            if (this.modal_selected_game == undefined) { return undefined; };
            let xp_by_id = this.xp_by_id;
            let el_by_id = this.el_by_id;
            let game_info = _.cloneDeep(this.gameweek_games_with_metadata[this.modal_selected_game]);
            if (game_info == undefined) { return undefined; }
            game_info.data = {};
            for (let i of game_info.stats) {
                let j = game_info.data[i.identifier] = {};
                j["home"] = i.h.map(i => xp_by_id[i.element].web_name + (i.value > 1 ? ` (${i.value})` : ""));
                j["away"] = i.a.map(i => xp_by_id[i.element].web_name + (i.value > 1 ? ` (${i.value})` : ""));
                j["total"] = j["home"].length + j["away"].length;
            }
            game_info.player_details.forEach((p) => { p.web_name = xp_by_id[p.id].web_name });
            game_info.player_details.sort((a, b) => { return b.rp - a.rp || b.xp - a.xp });
            game_info.players = _.groupBy(game_info.player_details, (i) => el_by_id[i.id].team == game_info.team_h ? "home" : "away");
            // debugger;
            return game_info;
        },
        team_data_with_metadata() {
            if (!this.is_ready) { return []; }
            const xp_by_id = this.xp_by_id;
            let info_by_id = this.ownership_by_id;
            let picks = _.cloneDeep(this.team_data.picks);
            let pos_ctr = { 1: 1, 2: 1, 3: 1, 4: 1, 'B': 1 }
            picks.forEach((e) => {
                let e_data = xp_by_id[e.element];
                let e_info = info_by_id[e.element];
                e.web_name = e_data.web_name;
                e.xp = parseFloat(e_data.points_md).toFixed(2);
                e.team = teams_ordered[e_data.team - 1];
                e.element_type = e_info.element_type;
                e.now_cost_str = (parseFloat(e_info.now_cost) / 10).toFixed(1);
            })
            picks.forEach((i) => {
                let cnt = picks.filter(j => j.element_type == i.element_type).filter(j => j.multiplier > 0).length;
                if (i.multiplier > 0) {
                    i.x = 122 / (cnt + 1) * pos_ctr[parseInt(i.element_type)] - 17;
                    i.y = (parseInt(i.element_type) - 1) * 35 + 3;
                    pos_ctr[parseInt(i.element_type)] += 1;
                } else {
                    i.x = 122 / 5 * pos_ctr['B'] - 17;
                    pos_ctr['B'] += 1;
                    i.y = 138.5;
                }
            })
            return picks;
        }
    },
    methods: {
        initEmptyData() {
            this.gw_fixture = [];
            this.team_data = [];
            this.el_data = [];
            this.xp_data = [];
            this.rp_data = [];
            this.sample_data = {};
            this.team_info = {};
            this.now_dt = new Date().getTime();
            this.modal_selected_game = undefined;
        },
        saveTeamData(data) {
            this.team_data = data;
        },
        saveTeamInfo(data) {
            this.team_info = data;
        },
        saveEl(data) {
            this.el_data = data;
        },
        saveXP(values) {
            this.xp_data = values;
        },
        saveRP(values) {
            this.rp_data = values;
        },
        saveFixtureData(data) {

            let sorted_fixture = data.sort((a, b) => { return a.kickoff_time - b.kickoff_time });

            sorted_fixture.forEach((game, index) => {
                game.start_dt = new Date(game.kickoff_time);
                game.end_dt = new Date(game.start_dt.getTime() + (105 * 60 * 1000));
                game.duration = 105 * 60 * 1000;
                game.team_h_name = teams_ordered[game.team_h - 1].name;
                game.team_a_name = teams_ordered[game.team_a - 1].name;
                game.label = teams_ordered[game.team_h - 1].name + " vs " + teams_ordered[game.team_a - 1].name;
                game.node_info = { start: (game.start_dt).getTime(), end: game.end_dt.getTime(), content: 'Game' }
                let order = 0;
                sorted_fixture.slice(0, index).forEach((game2) => {
                    if ((game.start_dt >= game2.start_dt && game.start_dt <= game2.end_dt) ||
                        (game.end_dt >= game2.start_dt && game.end_dt <= game2.end_dt)) {
                        order += 1;
                    }
                })
                game.order = order;
            })
            this.gw_fixture = sorted_fixture;

            let start_dt = sorted_fixture[0].start_dt;
            let end_dt = sorted_fixture[sorted_fixture.length - 1].end_dt;

            if (new Date(this.now_dt) > end_dt) {
                this.now_dt = modify_time(end_dt.getTime(), 2);
            } else if (new Date(this.now_dt) < start_dt) {
                this.now_dt = modify_time(start_dt.getTime(), -2);
            }

        },
        saveSampleData(success, data) {
            if (success) {
                this.sample_data = data;
                let sample_values = Object.keys(data).reverse().map(i => "Sample - " + sample_compact_number(i));
                this.available_sources = ["Official FPL API"].concat(sample_values);
                if (this.ownership_source == this.available_sources[0]) {
                    this.ownership_source = this.available_sources[1];
                }
            } else {
                this.sample_data = [];
                this.available_sources = ["Official FPL API"];
                this.ownership_source = this.available_sources[0];
            }
        },
        selectLeagueTeam() {
            this.team_id = $("#fpl_analytics_league_select").val();
            if (this.team_id == "") { return; }
            this.$nextTick(() => {
                $("#teamModal").modal('hide');
                load_team_data();
            })
        },
        saveTeamId() {
            this.team_id = $("#teamIdEnter").val();
            this.$nextTick(() => {
                $("#fpl_analytics_league_select").val("");
                $("#teamModal").modal('hide');
                load_team_data();
            })
        },
        game_label(game) {
            if (game == undefined) { return "." }
            if (game.finished_provisional) {
                return teams_ordered[game.team_h - 1].name + " vs " + teams_ordered[game.team_a - 1].name + " (" + game.team_h_score + "-" + game.team_a_score + ")";
            } else if (game.started) {
                return "(Live) " + teams_ordered[game.team_h - 1].name + " vs " + teams_ordered[game.team_a - 1].name + " (" + game.team_h_score + "-" + game.team_a_score + ")";
            } else {
                return teams_ordered[game.team_h - 1].name + " vs " + teams_ordered[game.team_a - 1].name;
            }
        },
        get_points_for_time(event_type, time, active_events, finished_events) {

            const ownership_by_id = this.ownership_by_id;

            let xp = 0;
            let picks = this.team_data.picks;
            if (!this.is_ready) { picks = []; }
            const team_ids = picks.map(i => i.element);

            let finished_players = finished_events.map(i => i.game.player_details).flat();
            let split_players = _.groupBy(finished_players, (e) => { return team_ids.includes(e.id) })

            // Part 1 - In my team
            let team_finished = split_players[true] || [];
            let team_finished_final = team_finished.map(i => {
                let multiplier = picks.find(j => j.element == i.id).multiplier;
                let ow = ownership_by_id[i.id];
                let eo = ow.effective_ownership / 100;
                if (!this.is_using_sample) { eo = ow.selected_by_percent / 100; }
                return { player: i, multiplier: multiplier, xp: i.xp, rp: i.rp, eo: eo };
            })
            let xp_total = getSum(team_finished_final.map(i => i.xp * i.multiplier));
            let rp_total = getSum(team_finished_final.map(i => i.rp * i.multiplier));
            let xp_gain = getSum(team_finished_final.map(i => i.xp * (i.multiplier - i.eo)));
            let rp_gain = getSum(team_finished_final.map(i => i.rp * (i.multiplier - i.eo)));

            // Part 2 - Not in my team
            let rest_finished = split_players[false] || [];
            let rest_finished_final = rest_finished.map(i => {
                let ow = ownership_by_id[i.id];
                let eo = ow.effective_ownership / 100;
                if (!this.is_using_sample) { eo = ow.selected_by_percent / 100; }
                return { player: i, multiplier: 0, xp: i.xp, rp: i.rp, eo: eo };
            })
            let xp_loss = getSum(rest_finished_final.map(i => i.xp * i.eo));
            let xp_diff = xp_gain - xp_loss;
            let rp_loss = getSum(rest_finished_final.map(i => i.rp * i.eo));
            let rp_diff = rp_gain - rp_loss;

            let average_expected = getSum(team_finished_final.map(i => i.xp * i.eo)) + xp_loss;
            let average_realized = getSum(team_finished_final.map(i => i.rp * i.eo)) + rp_loss;

            if (event_type == "now") {
                let copy_active_events = _.cloneDeep(active_events)

                copy_active_events.forEach((g) => {
                    g.completed = (time - g.game.node_info.start) / (g.game.node_info.end - g.game.node_info.start);
                    g.game.player_details.forEach((el) => {
                        el.xp = g.completed * el.xp;
                    })
                })

                let active_players = copy_active_events.map(i => i.game.player_details).flat();
                let team_active = active_players.filter(i => picks.map(j => j.element).includes(i.id));
                let team_active_final = team_active.map(i => {
                    let multiplier = picks.find(j => j.element == i.id).multiplier;
                    let ow = ownership_by_id[i.id];
                    let eo = ow.effective_ownership / 100;
                    if (!this.is_using_sample) { eo = ow.selected_by_percent / 100; }
                    return { player: i, multiplier: multiplier, xp: i.xp, rp: i.rp, eo: eo };
                })
                let xp_total_active = getSum(team_active_final.map(i => i.xp * i.multiplier));
                let rp_total_active = getSum(team_active_final.map(i => i.rp * i.multiplier));
                let xp_gain_active = getSum(team_active_final.map(i => i.xp * (i.multiplier - i.eo)));
                let rp_gain_active = getSum(team_active_final.map(i => i.rp * (i.multiplier - i.eo)));

                xp_total += xp_total_active; // TODO: this should come from active events
                rp_total += rp_total_active;
                xp_gain += xp_gain_active;
                rp_gain += rp_gain_active;
            }

            return { xp_total: xp_total, rp_total: rp_total, xp_gain: xp_gain, rp_gain: rp_gain, xp_loss: xp_loss, rp_loss: rp_loss, xp_diff: xp_diff, rp_diff: rp_diff, avg_expected: average_expected, avg_realized: average_realized }
        },
        openModalFor(id) {
            this.modal_selected_game = id;
            this.$nextTick(() => {
                $("#matchReportModal").modal('show');
            })
        }
    },
})

async function load_team_data() {

    if (app.team_id == -1) { return; }

    $("#waitModal").modal({
        backdrop: 'static',
        keyboard: false
    }).modal('show');

    await get_team_picks({ gw: app.gw.slice(2), team_id: app.team_id, force_last_gw: true }).then((response) => {
        app.saveTeamData(response.body);
        app.using_last_gw_team = response.is_last_gw;
    }).catch(error => {
        console.error(error);
        debugger;
    });

    return get_team_info(app.team_id)
        .then((data) => {
            app.saveTeamInfo(data);
        })
        .catch(error => {
            console.error(error);
        });
}

async function load_element_data() {
    return get_cached_element_data({ season: app.season, gw: app.gw, date: app.date })
        .then((data) => {
            app.saveEl(data);
        })
        .catch(error => {
            console.error(error);
        });
}

async function load_xp_data() {
    return getXPData({ season: app.season, gw: app.gw, date: app.date })
        .then((data) => {
            app.saveXP(data);
        })
        .catch(error => {
            console.error(error);
        });
}

async function load_rp_data() {
    return getRPData(app.gw.slice(2))
        .then((data) => {
            app.saveRP(data);
        })
        .catch(error => {
            app.saveRP([]);
            console.error(error);
        });
}

async function load_sample_data() {
    return get_sample_data(app.gw.slice(2))
        .then((data) => {
            app.saveSampleData(true, data);
        })
        .catch(error => {
            // Delete sample data and force official FPL API values
            app.saveSampleData(false, []);
        });
}

async function load_fixture_data() {
    return get_fixture(app.gw.slice(2))
        .then((data) => {
            app.saveFixtureData(data);
        })
        .catch(error => {
            console.error(error);
        });
}

let axis_functions = {};
let target_stat = {};

function init_timeline() {

    if (!app.is_fixture_ready) { return; }

    let graph_id = "timeline";

    var margin = { top: 9, right: 5, bottom: 20, left: 5 },
        width = 450 - margin.left - margin.right,
        height = 20 + 20 * (app.gameweek_info.channels + 1) - margin.top - margin.bottom;

    let cnv = d3.select("#d3-timeline")
        .append("svg")
        .attr("id", graph_id)
        .attr("viewBox", `0 0  ${(width + margin.left + margin.right)} ${(height + margin.top + margin.bottom)}`)
        .attr('class', 'pull-center active-graph')
        .style('display', 'block')
        .style('min-width', '700px')
        .style('padding-bottom', '10px');

    let svg = cnv.append('g').attr('class', 'svg-actual').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    svg.append('rect').attr('fill', '#5a5d5c').attr('width', width).attr('height', height);

    let game_color = (d) => {
        return d3.schemeDark2[d % 8];
    }

    // Min max values
    let vals = app.gameweek_games_with_metadata;
    let x_high = app.gameweek_info.end_dt.getTime() + 120 * 60 * 1000;
    let x_low = app.gameweek_info.start_dt.getTime() - 120 * 60 * 1000;

    let x_ticks = [];
    let start_midnight = new Date(app.gameweek_info.start_dt.getTime());
    start_midnight.setHours(24, 0, 0, 0);
    for (let i = start_midnight.getTime(); i <= x_high; i += 24 * 60 * 60 * 1000) {
        x_ticks.push(i)
    }

    // Axis-x
    var x = d3.scaleLinear().domain([x_low, x_high]).range([0, width]);
    svg.append('g')
        // .attr('transform', 'translate(0,' + height + ')')
        .call(
            d3.axisBottom(x).tickValues(x_ticks)
            .tickFormat(function(d, i) {
                return new Date(d).toLocaleDateString();
            })
            .tickSize(height)
        );

    axis_functions[graph_id] = {};
    axis_functions[graph_id].x = x;

    // Axis -y
    var y = d3.scaleBand().domain(vals.map(i => i.order)).range([height, 0]).paddingInner(0.1).paddingOuter(0.05);
    svg.append('g').call(d3.axisLeft(y).tickSize(0).tickValues([]));

    axis_functions[graph_id].y = y;

    svg.call(g => g.selectAll(".tick text")
            .attr("fill", "white"))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-dasharray", "4,2")
            .attr("stroke", "#f1f1f1")
            .attr("stroke-width", 0.5)
            .attr("opacity", 0.3)
            .style('pointer-events', 'none'))
        .call(g => g.selectAll(".domain")
            .attr("opacity", 0));

    // Title - x
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 17)
        .attr("font-size", "4pt")
        .attr("fill", "white")
        .text("Date/Time");

    svg.call(s => s.selectAll(".tick").attr("font-size", "4pt"));

    var Tooltip = d3.select("#timeline-wrapper")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip bg-dark text-white")
        .attr("id", "timeline-tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("color", "black");

    function mouseclick(d) {
        let game = d3.select(this);
        app.modal_selected_game = game.attr('data-index');
        app.$nextTick(() => {
            Tooltip.style("opacity", 0)
                .style("left", "0px")
                .style("top", "0px");
            $("#matchReportModal").modal('show');
        })
    }

    function mouseenter(d) {
        let game = d3.select(this);
        game.attr("opacity", 1);
        game.attr("fill", "red");
        // app.selected_game = game.attr('data-index');
        Tooltip.style("opacity", 0.85);
    }

    function mouseleave(d) {
        let game = d3.select(this);
        game.attr("opacity", 0.7);
        game.attr("fill", game_color(game.attr('data-index')));
        // app.selected_game = undefined;
        Tooltip.style("opacity", 0)
            .style("left", "0px")
            .style("top", "0px");
    }

    function mousemove(e, d) {
        let offset = -20;
        try {
            offset = -Tooltip.node().getBoundingClientRect().width / 2;
        } catch {}
        team_lines = ''

        if (app.is_ready) {
            if (d.started) {
                team_lines = `
                <tr><td class="text-right">xP Gain</td><td>${getWithSign(d.xp_team_gain)}</td></tr>
                <tr><td class="text-right">rP Gain</td><td>${getWithSign(d.rp_team_gain)}</td></tr>
                <tr><td class="text-right">xP Loss</td><td>${getWithSign(d.xp_team_loss)}</td></tr>
                <tr><td class="text-right">rP Loss</td><td>${getWithSign(d.rp_team_loss)}</td></tr>
                `
            } else {
                team_lines = `
                <tr><td class="text-right">xP Gain</td><td>${getWithSign(d.xp_team_gain)}</td></tr>
                <tr><td class="text-right">xP Loss</td><td>${getWithSign(d.xp_team_loss)}</td></tr>
                `
            }
        }

        if (d.finished_provisional) {
            Tooltip.html(
                `<div class="tooltip-inside text-small"><b>${d.game_string}</b><br/>
                <table class="table table-dark table-sm table-striped mb-0">
                    <tr><td class="text-right">Total xP</td><td>${(d.xp_sum).toFixed(2)}</td></tr>
                    <tr><td class="text-right">Total rP</td><td>${d.rp_sum}</td></tr>
                    ${team_lines}
                </table></div>`);
        } else {
            Tooltip.html(
                `<div class="tooltip-inside text-small"><b>${d.game_string}</b><br/>
                <table class="table table-dark table-sm table-striped mb-0">
                    <tr><td class="text-right">Total xP</td><td>${(d.xp_sum).toFixed(2)}</td></tr>
                    ${team_lines}
                </table></div>`);
        }

        Tooltip
            .style("left", (e.pageX + offset) + "px")
            .style("top", (e.pageY + 30) + "px")
    }


    // Games
    svg.append("g")
        .selectAll()
        .data(vals)
        .enter()
        .append('rect')
        // .attr("transform", function(d) { return "translate(" + x(d.node_info.start) + ",0)"; })
        .attr("x", d => x(d.node_info.start))
        .attr("width", d => x(d.node_info.end) - x(d.node_info.start))
        .attr("y", d => y(d.order))
        .attr("height", y.bandwidth())
        .attr("opacity", 0.7)
        .attr("fill", (d, i) => game_color(i))
        .attr("stroke", "#d2d2d2")
        .attr("stroke-width", 0.5)
        .attr("data-index", (d, i) => i)
        .style("cursor", "pointer")
        .on("mouseenter", mouseenter)
        .on("mouseleave", mouseleave)
        .on("mousemove", mousemove)
        .on("click", mouseclick);

    let right_now = new Date(app.now_dt);
    let now_time = right_now.getTime();

    let now_group = svg.append('g');
    now_group
        .append('line')
        .attr('id', 'now')
        .attr("pointer-events", "none")
        .attr('x1', x(now_time))
        .attr('y1', y.range()[0])
        .attr('x2', x(now_time))
        .attr('y2', y.range()[1] - 2)
        .style('stroke', '#60ffc9')
        .style("stroke-dasharray", "2,0.5")
        .style("stroke-width", 1)
        .style("stroke-opacity", 0.7);

    now_group.append('text')
        .attr("text-anchor", "middle")
        .attr("x", x(now_time))
        .attr("y", -6)
        .attr("font-size", "3pt")
        .attr("fill", "white")
        .text("Now");

    svg.on('mouseenter.foo', (e) => { synced_enter(e, graph_id); });
    svg.on('mousemove.foo', (e) => { synced_move(e, graph_id); });
    svg.on('mouseleave.foo', (e) => { synced_leave() });

    let left_offset = document.querySelector("#now").getBoundingClientRect().x - window.innerWidth / 2;
    $("#d3-timeline").scrollLeft(left_offset);

}

function draw_user_graph(options = {}) {
    // graph-wrapper-points

    if (!app.is_ready) { return; }

    let graph_id = "graph-" + options.stat;
    target_stat[graph_id] = options.stat;

    var margin = { top: 25, right: 5, bottom: 20, left: 15 },
        width = 250 - margin.left - margin.right,
        height = 180 - margin.top - margin.bottom;

    let cnv = d3.select(options.target)
        .append("svg")
        .attr("id", graph_id)
        .attr("viewBox", `0 0  ${(width + margin.left + margin.right)} ${(height + margin.top + margin.bottom)}`)
        .attr('class', 'pull-center active-graph')
        .style('display', 'block')
        .style('padding-bottom', '10px');

    let svg = cnv.append('g').attr('class', 'svg-actual').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    svg.append('rect').attr('fill', '#5a5d5c').attr('width', width).attr('height', height);

    // Min max values
    let data = app.get_graph_checkpoints;
    if (data.length == 0) { return; }

    let x_high = data[data.length - 1].time;
    let x_low = data[0].time;

    let y_high = Math.max(...data.map(i => i.expected[options.stat]).concat(data.map(i => i.realized[options.stat]))) + 5;
    let y_low = Math.min(...data.map(i => i.expected[options.stat]).concat(data.map(i => i.realized[options.stat])));

    let x_ticks = [];
    let start_midnight = new Date(app.gameweek_info.start_dt.getTime());
    start_midnight.setHours(24, 0, 0, 0);
    for (let i = start_midnight.getTime(); i <= x_high; i += 24 * 60 * 60 * 1000) {
        x_ticks.push(i)
    }


    // Axis-x
    var x = d3.scaleLinear().domain([x_low, x_high]).range([0, width]);
    svg.append('g')
        // .attr('transform', 'translate(0,' + height + ')')
        .call(
            d3.axisBottom(x).tickValues(x_ticks)
            .tickFormat(function(d, i) {
                return new Date(d).toLocaleDateString();
            })
            .tickSize(height)
        );

    axis_functions[graph_id] = {};
    axis_functions[graph_id].x = x;

    // Axis -y
    // var y = d3.scaleBand().domain(vals.map(i => i.order)).range([height, 0]).paddingInner(0.1).paddingOuter(0.05);
    // svg.append('g').call(d3.axisLeft(y).tickSize(0).tickValues([]));

    var y = d3.scaleLinear().domain([y_low, y_high]).range([height, 0]);
    svg.append('g').attr("transform", "translate(" + width + ",0)").call(d3.axisLeft(y).tickSize(width));

    axis_functions[graph_id].y = y;

    svg.call(g => g.selectAll(".tick text")
            .attr("fill", "white"))
        .call(g => g.selectAll(".tick line")
            .attr("stroke-dasharray", "4,2")
            .attr("stroke", "#f1f1f1")
            .attr("stroke-width", 0.5)
            .attr("opacity", 0.1)
            .style('pointer-events', 'none'))
        .call(g => g.selectAll(".domain")
            .attr("opacity", 0));

    // Title - x
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 17)
        .attr("font-size", "4pt")
        .attr("fill", "white")
        .text("Date/Time");

    svg.call(s => s.selectAll(".tick").attr("font-size", "4pt"));

    let right_now = new Date(app.now_dt);
    let now_time = right_now.getTime();

    // Now line
    let now_group = svg.append('g');
    now_group
        .append('line')
        .attr('id', 'now')
        .attr("pointer-events", "none")
        .attr('x1', x(now_time))
        .attr('y1', y(y_low))
        .attr('x2', x(now_time))
        .attr('y2', y(y_high))
        .style('stroke', '#60ffc9')
        .style("stroke-dasharray", "2,0.5")
        .style("opacity", 0.3)
        .style("stroke-width", 1)
        .style("stroke-opacity", 0.7);

    now_group.append('text')
        .attr("text-anchor", "middle")
        .attr("x", x(now_time))
        .attr("y", -6)
        .attr("font-size", "3pt")
        .attr("fill", "white")
        .text("Now");

    svg.append('text')
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", -15)
        .attr("font-size", "5pt")
        .attr("fill", "white")
        .text(options.title);

    svg.on('mouseenter.foo', (e) => { synced_enter(e, graph_id); });
    svg.on('mousemove.foo', (e) => { synced_move(e, graph_id); });
    svg.on('mouseleave.foo', (e) => { synced_leave() });

    // expected values line

    svg.append('path')
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#dbf7b4")
        .attr("stroke-opacity", 0.8)
        .style("stroke-dasharray", "2,0.5")
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .x((d) => x(d.time))
            .y((d) => y(d.expected[options.stat]))
        );

    let realized_data = _.cloneDeep(data)
    const now_index = realized_data.findIndex(i => i.reason == "now")
    realized_data = realized_data.slice(0, now_index + 1);

    // realized values line

    svg.append('path')
        .datum(realized_data)
        .attr("fill", "none")
        .attr("stroke", "#6fcfd6")
        .attr("stroke-opacity", 0.8)
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .x((d) => x(d.time))
            .y((d) => y(d.realized[options.stat]))
        );

    if (options.stat == "points") {

        svg.append('path')
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#ffc356")
            .attr("stroke-opacity", 0.8)
            .style("stroke-dasharray", "2,0.5")
            .attr("stroke-width", 1)
            .attr("d", d3.line()
                .x((d) => x(d.time))
                .y((d) => y(d.average.expected))
            );

        svg.append('path')
            .datum(realized_data)
            .attr("fill", "none")
            .attr("stroke", "#de6363")
            .attr("stroke-opacity", 0.8)
            .attr("stroke-width", 1)
            .attr("d", d3.line()
                .x((d) => x(d.time))
                .y((d) => y(d.average.realized))
            );
    }
    reset_graph_values();
}

function reset_graph_values() {
    let graph_types = ["graph-points", "graph-diff", "graph-gain", "graph-loss"];
    let x_raw = app.now_dt;
    for (let i of graph_types) {
        update_graph_hover_values(x_raw, i);
    }
}

function update_graph_hover_values(x_raw, gid) {

    let raw_data = app.get_graph_checkpoints;
    let x_targets = raw_data.map(i => i.time);

    let id_left = d3.bisect(x_targets, x_raw) - 1;
    let id_right = id_left + 1;
    if (id_left == -1) {
        id_left = 0;
        id_right = 0;
    }
    if (id_right == x_targets.length) {
        id_left = id_right = x_targets.length - 1;
    }
    let x_left = raw_data[id_left];
    let x_right = raw_data[id_right];
    let ratio = (x_raw - x_left.time) / Math.max(x_right.time - x_left.time, 1);
    const find_y = (left_val, right_val) => left_val * (1 - ratio) + right_val * ratio;
    const stat = target_stat[gid];
    let expected_y = find_y(x_left.expected[stat], x_right.expected[stat]);
    $("#" + stat + "-expected-you").html(expected_y.toFixed(2));
    let digits = 2;
    if (stat == "points") { digits = 0; }
    let realized_y = find_y(x_left.realized[stat], x_right.realized[stat]);
    $("#" + stat + "-realized-you").html(realized_y.toFixed(digits));
    if (stat == "points") {
        let expected_y = find_y(x_left.average.expected, x_right.average.expected);
        $("#" + stat + "-expected-avg").html(expected_y.toFixed(2));
        let realized_y = find_y(x_left.average.realized, x_right.average.realized);
        $("#" + stat + "-realized-avg").html(realized_y.toFixed(2));
    }
}

function synced_enter(e, d) {
    let x_now = d3.pointer(e)[0];
    let x_raw = axis_functions[d].x.invert(x_now);

    $("svg.active-graph").each((i, svg) => {
        let gid = svg.id;
        let x = axis_functions[gid].x;
        let y = axis_functions[gid].y;
        let target = d3.select($(svg).find(".svg-actual")[0]);
        target.append('line')
            .attr('class', 'guide')
            .attr('x1', x(x_raw))
            .attr('y1', y.range()[0])
            .attr('x2', x(x_raw))
            .attr('y2', y.range()[1])
            .style('stroke', 'yellow')
            .style("stroke-dasharray", "3,1")
            .style("opacity", 0.5)
            .attr("pointer-events", "none");
        target.append('text')
            .attr('class', 'guidetext')
            .attr("text-anchor", "middle")
            .attr("x", x(x_raw))
            .attr("y", -2)
            .attr("font-size", "3pt")
            .attr("fill", "white")
            .text(new Date(x_raw).toLocaleString());

        if (gid == "timeline") { return; }

        update_graph_hover_values(x_raw, gid);

    })
}

function synced_move(e, d) {

    let x_now = d3.pointer(e)[0];
    let x_raw = axis_functions[d].x.invert(x_now);
    $("svg.active-graph").each((i, svg) => {
        let gid = svg.id;
        let target = d3.select($(svg).find(".svg-actual")[0]);
        let x = axis_functions[gid].x;
        let y = axis_functions[gid].y;

        target.select(".guide")
            .attr('x1', x(x_raw))
            .attr('x2', x(x_raw));
        target.select(".guidetext")
            .attr('x', x(x_raw))
            .text(new Date(x_raw).toLocaleString());

        update_graph_hover_values(x_raw, gid);
    })
}

function synced_leave() {
    $("line.guide").remove();
    $("text.guidetext").remove();
    reset_graph_values();
}


function zoomInSvg() {
    let svgEl = document.querySelector("svg#timeline");
    let currentWidth = svgEl.getBoundingClientRect().width;
    let currentMinWidth = parseInt(svgEl.style.minWidth.replace("px", ""));
    if (currentMinWidth < currentWidth) {
        svgEl.style.minWidth = (currentWidth + 100) + "px";
    } else {
        if (currentMinWidth < 2000) {
            svgEl.style.minWidth = (currentMinWidth + 100) + "px";
        }
    }
}

function zoomOutSvg() {
    let svgEl = document.querySelector("svg#timeline");
    let currentMinWidth = parseInt(svgEl.style.minWidth.replace("px", ""));
    if (currentMinWidth > 200) {
        svgEl.style.minWidth = (currentMinWidth - 100) + "px";
    }
}

function refreshFixtureData() {
    $("#fixtureModal").modal({
        backdrop: 'static',
        keyboard: false
    }).modal('show');
    app.now_dt = new Date().getTime();
    $(".svg-wrapper").empty()
    load_fixture_data().then(() => {
        $("#fixtureModal").modal('hide');
    });
}

function refresh_all_graphs() {
    $("#waitModal").modal({
        backdrop: 'static',
        keyboard: false
    }).modal('show');
    $(".svg-wrapper").empty();
    app.$nextTick(() => {
        init_timeline();
        draw_user_graph({ target: "#graph-wrapper-points", stat: "points", title: "Points" });
        draw_user_graph({ target: "#graph-wrapper-diff", stat: "diff", title: "Difference to Average" });
        draw_user_graph({ target: "#graph-wrapper-gain", stat: "gain", title: "Weighted Gain (Owned)" });
        draw_user_graph({ target: "#graph-wrapper-loss", stat: "loss", title: "Weighted Loss (Non-owned)" });
        $("#waitModal").modal('hide');
    });
}

async function app_initialize(refresh_team = false) {

    $("#updateModal").modal({
        backdrop: 'static',
        keyboard: false
    }).modal('show');

    app.initEmptyData();

    Promise.all([
            load_fixture_data(),
            load_element_data(),
            load_xp_data(),
            load_rp_data(),
            load_sample_data(),
            load_team_data()
        ]).then((values) => {
            $(".svg-wrapper").empty()
            refresh_all_graphs();
            $("#updateModal").modal('hide');
        })
        .catch((error) => {
            console.error("An error has occured: " + error);
            $("#updateModal").modal('hide');
        })
}

$(document).ready(function() {
    app_initialize();
    // app.modal_selected_game = 0;
    // $("#matchReportModal").modal('show');
});