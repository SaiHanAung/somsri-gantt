import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import {
    getDatabase,
    set,
    ref,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const c = console.log.bind();
const firebaseConfig = {
    apiKey: "AIzaSyCKxEYUtxMrevfSLSRHKUHc7gKTSKBZ-Vg",
    authDomain: "somsritshirt-ced49.firebaseapp.com",
    databaseURL: "https://somsritshirt-ced49.firebaseio.com",
    projectId: "somsritshirt-ced49",
    storageBucket: "somsritshirt-ced49.appspot.com",
    messagingSenderId: "99816736698",
    appId: "1:99816736698:web:a5fb5f8f10194c8221ff83"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const database = getDatabase(app);
const { createApp } = Vue
let oldToken

const vm = createApp({
    data() {
        return {
            data: null,
            projectName: null,
            blockStart: null,
            blockEnd: null,
            gantts: null,
            ganttGroup: [],
            tabActive: null,
            event: null,
            loading: true,
            isLoggedIn: false,
            user: {},
            toast: Swal.mixin({
                toast: true,
                position: "top-end",
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.onmouseenter = Swal.stopTimer;
                    toast.onmouseleave = Swal.resumeTimer;
                }
            }),
            filters: [],
        };
    },
    methods: {
        resetUserInput() {
            this.user = {}
        },
        checkOldToken() {
            if (oldToken) {
                this.user.airtable_token = oldToken
            }
        },
        signOut() {
            signOut(auth)
            this.user = {};
            this.isLoggedIn = false
        },
        closeModal(modalId) {
            document.getElementById(modalId).close();
        },
        setting(modalId) {
            if (!this.user.verify_token) {
                return this.toast.fire({
                    icon: "warning",
                    title: "ตรวจสอบ Token ก่อน"
                });
            }

            update(ref(database, `gantts/users/${this.user.uid}`), {
                airtable_token: this.user.airtable_token
            })
                .then(() => {
                    this.closeModal(modalId);
                })
                .catch((err) => {
                    console.error(err)
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างที่ setting() > update()"
                    });
                })
        },
        async verifyToken() {
            if (!this.user.airtable_token) {
                return this.toast.fire({
                    icon: "warning",
                    title: "กรอก Token ก่อน"
                });
            }

            const header = {
                headers: {
                    Authorization: `Bearer ${this.user.airtable_token}`
                }
            }
            try {
                const resp = await axios.get('https://api.airtable.com/v0/meta/whoami', header)

                if (resp.data.id) {
                    this.user.verify_token = true
                    return
                }
            }
            catch (err) {
                if (oldToken) {
                    this.user.airtable_token = oldToken
                }
                this.toast.fire({
                    icon: "error",
                    title: "Token ไม่ถูกต้อง ไม่สามารถเชื่อมต่อด้วย Token นี้ได้"
                });
                console.error(err)
            }
        },
        register(modalId) {
            createUserWithEmailAndPassword(auth, this.user.email, this.user.password)
                .then((userCredential) => {

                    const user = userCredential.user;

                    set(ref(database, 'gantts/users/' + user.uid), {
                        email: user.email,
                        airtable_token: 0
                    }).catch((err) => {
                        console.error(err)
                        this.toast.fire({
                            icon: "error",
                            title: "เกิดปัญหาบางอย่างที่ register() > set()"
                        });
                    });
                    this.closeModal(modalId);
                })
                .catch((err) => {
                    if (err.customData._tokenResponse.error.message == 'EMAIL_EXISTS') {
                        return this.toast.fire({
                            icon: "warning",
                            title: "Email นี้ถูกใช้ไปแล้ว"
                        });
                    }
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างที่ register()"
                    });
                    console.error(err)
                });
        },
        async fetchUserData() {
            const starCountRef = ref(database, `gantts/users/${this.user.uid}`);
            await onValue(starCountRef, (snapshot) => {
                Object.assign(this.user, snapshot.val())
                if (snapshot.val().airtable_token != 0) {
                    oldToken = snapshot.val().airtable_token
                    this.getGantt();
                } else {
                    this.isLoaded();
                }
            })
        },
        login(modalId) {
            this.isLoading();
            signInWithEmailAndPassword(auth, this.user.email, this.user.password).then((userCredential) => {
                this.user.err = null
                this.closeModal(modalId);
                this.user.email = userCredential._tokenResponse.email
                this.user.password = ""

                this.fetchUserData();
            }).catch(() => {
                this.isLoaded();
                this.user.err = "อีเมลหรือรหัสผ่านผิด"
            })
        },
        async checkAuth() {
            this.isLoading();
            await onAuthStateChanged(auth, (user) => {
                if (user) {
                    this.user = user
                    this.isLoggedIn = true
                    this.fetchUserData();
                } else {
                    this.isLoaded();
                }
            });
        },
        isLoading() {
            this.loading = true;
        },
        isLoaded() {
            this.loading = false;
        },
        getGantt() {
            axios(
                "https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0",
                {
                    headers: `Authorization: Bearer ${this.user.airtable_token}`,
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
                                record_id: d.id,
                                base_id: d.fields.base_id,
                                base_name: d.fields.base_name,
                                tables: []
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

                        return d.fields.base_id;
                    });
                    this.gantts = ganttGroup;
                    this.isLoaded();
                })
                .catch((err) => {
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างขึ้นที่ getGantt()"
                    });
                    console.error(err);
                });
        },
        showGantt(g) {
            this.isLoading();
            axios(`https://api.airtable.com/v0/${g.base_id}/${g.table_id}`, {
                headers: `Authorization: Bearer ${this.user.airtable_token}`,
            })
                .then((el) => {
                    let groupBy
                    this.data = el.data.records.filter(record => record.fields[g.field_group])
                        .map((d) => {
                            this.projectName = d.fields[g.field_name];
                            this.blockStart = d.fields[g.field_start];
                            this.blockEnd = d.fields[g.field_end];
                            let groupSort = g.group_sort;
                            if (groupSort) {
                                let groupArr = groupSort.split(',');
                                Object.entries(groupArr).map((group, index) => {
                                    if (d.fields[g.field_group] == group[1]) {
                                        groupBy = `${index + 1}. ${group[1]}`
                                    }
                                })
                            }
                            return {
                                id: d.id,
                                title: this.projectName,
                                groupBy: groupBy || d.fields[g.field_group],
                                resourceId: d.id,
                                start: this.blockStart,
                                end: this.blockEnd,
                                fields: d.fields
                            };
                        });
                    this.isLoaded();
                    this.renderCalendar();
                })
                .catch((err) => {
                    this.toast.fire({
                        icon: "error",
                        title: "เกิดปัญหาบางอย่างขึ้นที่ showGantt()"
                    });
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
                slotMinTime: "08:00:00",
                slotMaxTime: "18:00:00",
                editable: true,
                resources: this.filteredData,
                // resourceAreaHeaderContent: `${this.tabActive?.button_name || "ชื่อโปรเจกต์"
                //     }`,
                resourceAreaHeaderContent: {
                    html: `<div class="flex items-center gap-1">
                            ${vm.tabActive?.button_name ? `<small class="px-1 btn btn-sm btn-ghost ${vm.filters.length > 0 ? 'bg-[#a52241] hover:bg-rose-900 text-white' : ''}" onclick="filter_modal.showModal()"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg></small>` : ''}
                            <span>${vm.tabActive?.button_name || "ชื่อโปรเจกต์"}</span>
                        </div>
                        `
                },
                // resourceAreaHeaderContent: (info) => c(info),
                resourceLabelContent: function (info) {
                    const sliceDate = (start, end) => {
                        if (!start || !end) return ''
                        const thaiDate = (date) => {
                            const arrDate = new Date(date).toLocaleDateString('th').split("/")
                            return `${arrDate[0]}/${arrDate[1]}`
                        }
                        return ` 📅 ${thaiDate(start)} ถึง ${thaiDate(end)}`
                    }

                    const { start, end } = info.resource._resource.extendedProps
                    return { html: `${info.resource.title} <small class="text-[#a52241]">${sliceDate(start, end)}</small>` }
                },
                resourceOrder: "groupBy,start",
                resourceGroupField: 'groupBy',
                displayEventTime: false,
                events: this.filteredData,
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
        saveFilter() {
            const headers = {
                Authorization: `Bearer ${this.user.airtable_token}`,
                "Content-Type": "application/json",
            };
            try {
                axios.patch(`https://api.airtable.com/v0/appjfqpEHmnEsozi9/tbl64GrdfhsMbqiJ0/${this.tabActive.record_id}`,
                    {
                        fields: { conditions: JSON.stringify(this.filters) },
                    },
                    { headers }
                ).then((valUpdate) => {
                    this.closeModal('filter_modal')

                    const { id, fields } = valUpdate.data
                    this.tabActive = fields
                    this.tabActive.record_id = id
                    this.showGantt(this.tabActive)
                })
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดปัญหาบางอย่างขึ้นที่ saveFilter()"
                });
                console.error(err);
            }
        },
        updateRecords() {
            const headers = {
                Authorization: `Bearer ${this.user.airtable_token}`,
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
                update(ref(database, `gantts/users/${this.user.uid}`), {
                    airtable_update_data_at: new Date().toLocaleDateString('th') + " " + new Date().toLocaleTimeString('th')
                })
            } catch (err) {
                this.toast.fire({
                    icon: "error",
                    title: "เกิดปัญหาบางอย่างขึ้นที่ updateRecords()"
                });
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
        addFilter() {
            if (this.filters.length == 0) return this.filters.push({ field_name: '', operator: '=', value: '' })
            this.filters.push({ field_name: '', operator: '=', value: '', more: 'OR' })
        }
    },
    computed: {
        filteredData() {
            let conditions
            if (this.tabActive?.conditions && this.tabActive.conditions !== "\n") {
                conditions = JSON.parse(this.tabActive.conditions.replace(/\\/g, ''))
                this.filters = conditions
            } else {
                this.filters = []
            }

            function filterData(datas, conditions) {
                if (!conditions || conditions.length === 0) return datas;

                return datas.filter(d => {
                    if (!conditions) return d;
                    const results = conditions.map(condition => {
                        if (condition.more === "OR") {
                            return d.fields[condition.field_name] == condition.value;
                        } else {
                            switch (condition.operator) {
                                case '=':
                                    return d.fields[condition.field_name] == condition.value;
                                case '!=':
                                    return d.fields[condition.field_name] != condition.value;
                                default:
                                    return true;
                            }
                        }
                    })
                    return results.includes(true);
                })

            }

            const filteredData = filterData(this.data, conditions);
            return filteredData
        }
    },
    async mounted() {
        await this.checkAuth();
        this.renderCalendar();
        window.addEventListener("resize", () => this.windowResize());
        window.addEventListener("focus", () => this.showGantt(this.tabActive));
    },
}).mount("#app")