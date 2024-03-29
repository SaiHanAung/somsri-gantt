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
            gantt: null,
            ganttGroup: [],
            tabActive: null,
            event: null,
            loading: true,
            isLoggedIn: false,
            user: {},
        };
    },
    methods: {
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
                return alert("ตรวจสอบ Token ก่อน")
            }

            update(ref(database, `gantts/users/${this.user.uid}`), {
                airtable_token: this.user.airtable_token
            })
                .then(() => {
                    this.closeModal(modalId);
                })
                .catch((err) => {
                    console.error(err)
                    alert("เกิดปัญหาบางอย่าง At setting() > update()")
                })
        },
        async verifyToken() {
            if (!this.user.airtable_token) return alert("กรอก Token ก่อน")

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
                const resp = err.response
                if (resp.status == 401) {
                    if (oldToken) {
                        this.user.airtable_token = oldToken
                    }
                    alert('Token ไม่ถูกต้อง ไม่สามารถเชื่อมต่อด้วย Token นี้ได้')
                    return
                }
                alert('เกิดปัญหาระหว่างตรวจสอบ API Key')
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
                        alert("เกิดปัญหาบางอย่าง At register() > set()")
                    });
                    this.closeModal(modalId);
                })
                .catch((err) => {
                    if (err.customData._tokenResponse.error.message == 'EMAIL_EXISTS') {
                        alert("Email นี้ถูกใช้ไปแล้ว")
                        return
                    }
                    alert("เกิดปัญหาบางอย่าง At register()")
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
                // console.error(err)
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
                headers: `Authorization: Bearer ${this.user.airtable_token}`,
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
        await this.checkAuth();
        this.renderCalendar();
        window.addEventListener("resize", () => this.windowResize());
    },
}).mount("#app")