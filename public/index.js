
const { createApp, ref } = Vue;
const c = console.log.bind();

const vm = createApp({
    data() {
        return {
            data: null,
            projectName: null,
            blockStart: null,
            blockEnd: null,
            gantt: null,
            ganttGroup: [],
            tabActive: null,
            event: null,
            token:
                "patUwun54PguoydSk.961825af2071bd0dc11c3fa5861a03c46b41cad4714ec3039b34f648ee418047",
            loading: true,
        };
    },
    methods: {
        isLoading() {
            this.loading = true;
        },
        isLoaded() {
            this.loading = false;
        },
        async getGantt() {
            await axios(
                "https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0",
                {
                    headers: `Authorization: Bearer ${this.token}`,
                }
            )
                .then((el) => {
                    const ganttGroup = [];
                    el.data.records.map((d) => {
                        if (
                            d.fields.base_id &&
                            ganttGroup.findIndex((g) => g.base_id == d.fields.base_id) <
                            0
                        ) {
                            ganttGroup.push({
                                base_id: d.fields.base_id,
                                base_name: d.fields.base_name,
                                tables: [],
                            });
                        }

                        ganttGroup.map((gg) => {
                            if (
                                gg.tables.findIndex(
                                    (tb) => tb.table_id == d.fields.table_id
                                ) < 0 &&
                                gg.base_id == d.fields.base_id
                            ) {
                                gg.tables.push({
                                    table_id: d.fields.table_id,
                                    table_name: d.fields.table_name,
                                    views: [],
                                });
                            }
                            gg.tables.map((tb) => {
                                if (
                                    tb.views.findIndex(
                                        (tb) => tb.button_name == d.fields.button_name
                                    ) < 0 &&
                                    gg.base_id == d.fields.base_id
                                ) {
                                    tb.views.push(d.fields);
                                }
                            });
                        });

                        this.gantt = ganttGroup;
                        return d.fields.base_id;
                    });
                    this.isLoaded();
                })
                .catch((err) => {
                    alert("เกิดปัญหาบางอย่างขึ้น At getGantt()");
                    console.error(err);
                });
        },
        showGantt(g) {
            this.isLoading();
            this.tabActive = g;
            axios(`https://api.airtable.com/v0/${g.base_id}/${g.table_id}`, {
                headers: `Authorization: Bearer ${this.token}`,
            })
                .then((el) => {
                    this.data = el.data.records.map((d) => {
                        this.projectName = d.fields[g.field_name];
                        this.blockStart = d.fields[g.field_start];
                        this.blockEnd = d.fields[g.field_end];
                        return {
                            id: d.id,
                            title: this.projectName,
                            resourceId: d.id,
                            start: this.blockStart,
                            end: this.blockEnd,
                        };
                    });
                    this.isLoaded();
                    this.renderCalendar();
                })
                .catch((err) => {
                    alert("เกิดปัญหาบางอย่างขึ้น At showGantt()");
                    console.error(err);
                });
        },
        renderCalendar() {
            var calendarEl = document.getElementById("calendar");
            var calendar = new FullCalendar.Calendar(calendarEl, {
                height: this.windowResize(),
                schedulerLicenseKey: "GPL-My-Project-Is-Open-Source",
                timeZone: "UTC",
                initialView: "resourceTimelineMonth",
                aspectRatio: 1.5,
                headerToolbar: {
                    left: "today prev,next",
                    center: "title",
                    right:
                        "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
                },
                buttonText: {
                    today: "วันนี้",
                    day: "รายวัน",
                    week: "รายสัปดาห์",
                    month: "รายเดือน",
                },
                resourceAreaHeaderContent: `${this.tabActive?.button_name || "ชื่อโปรเจกต์"
                    }`,
                editable: true,
                resources: this.data,
                events: this.data,
                resourceOrder: "start",
                displayEventTime: false,
                eventColor: "#a52241",
                eventResize: function (info) {
                    const { startStr, endStr, id, title } = info.event;
                    vm.event = {
                        id: id,
                        name: title,
                        start: startStr,
                        end: endStr,
                    };
                    vm.updateRecords();
                },
                eventDrop: function (info) {
                    info.revert();
                },
            });

            calendar.setOption("locale", "th");
            calendar.render();
        },
        updateRecords() {
            const headers = {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
            };
            try {
                axios.patch(
                    `https://api.airtable.com/v0/${this.tabActive.base_id}/${this.tabActive.table_id}/${this.event.id}`,
                    {
                        fields: {
                            [this.tabActive.field_start]: this.event.start,
                            [this.tabActive.field_end]: this.event.end,
                        },
                    },
                    { headers }
                );
            } catch (err) {
                alert("เกิดปัญหาบางอย่างขึ้น At updateRecords()");
                console.error(err);
            }
        },
        windowResize() {
            const element = document.getElementById("calendar");
            const windowHeight = window.innerHeight;
            const size = windowHeight - 40 + "px";
            element.style.height = size;

            return size;
        },
    },
    async mounted() {
        this.getGantt();
        this.renderCalendar();
        window.addEventListener("resize", () => this.windowResize());
    },
}).mount("#app");