<template>
    <div class="app">
        <HeaderComp :title="settings.title" :description="settings.description" />
        <div class="section" v-for="section in sections" :key="section.sectionName">
            <h2 v-html="renderMarkdown(section.sectionName)" :id="section.sectionName"></h2>
            <p 
                class="section-description" 
                v-if="sectionInfoDict[section.sectionName]"
                v-html="renderMarkdown(sectionInfoDict[section.sectionName].description)"
            ></p>
            <div class="section-content" v-if="isSection(section)">
                <TabSwitcher :files="section.items" @select="(file) => handleFileSelect(file, section.sectionName)" 
                    @click="(itemName) => handleFileSwitcherClick(section.sectionName, itemName)"
                    :selectedFile="selectedItems[section.sectionName]" :ref="(el)=>dictRefCallback(el, tabSwitchers, section.sectionName)">
                    <PianorollEditor 
                        :ref="(el)=>dictRefCallback(el, editors, section.sectionName)"
                        class="editor" 
                        :minPitch="21" 
                        :maxPitch="108" 
                        :editable="false"
                        @focus="() => handleEditorFocus(section)"
                    ></PianorollEditor>
                </TabSwitcher>
            </div>
            <div class="section-content" v-else>
                <TabSwitcher :files="section.items" @select="(file) => handleGroupFileSelect(file, section)" 
                    @click="(itemName) => handleFileSwitcherClick(section.sectionName, itemName)"
                    :selectedFile="selectedItems[section.sectionName]" :ref="(el)=>dictRefCallback(el, tabSwitchers, section.sectionName)">
                    <EditorGroup 
                        :ref="(el)=>dictRefCallback(el, editors, section.sectionName)"
                        class="editor-group"
                        :names="section.groupMembers"
                        @focus="() => handleEditorFocus(section)"
                    />
                </TabSwitcher>
            </div>
        </div>
        <SettingsPanel />
        <FooterComp />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { marked } from 'marked'
import PianorollEditor from './components/PianorollEditor.vue'
import HeaderComp from './components/HeaderComp.vue'
import TabSwitcher from './components/TabSwitcher.vue'
import EditorGroup from './components/EditorGroup.vue'
import FooterComp from './components/FooterComp.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useStore } from '@/stores/bpmStore'
import { player } from './player'

const tabSwitchers = ref<Record<string, any>>({})
const editors = ref<Record<string, InstanceType<typeof PianorollEditor> | InstanceType<typeof EditorGroup>>>({})
const selectedItems = ref<Record<string, string>>({})
let allowNextFragmentUpdate = false
let ignoreNextHashChange = false

const dictRefCallback = <T>(el: T | null, dict: Record<string, any>, key: string) => {
    console.log('dictRefCallback', el, dict, key)
    if (el) {
        dict[key] = el
    } else {
        delete dict[key]
    }
}

function isSection(section: Section | GroupedSection): section is Section {
    return !('groupMembers' in section);
}

type Section = { sectionName: string, items: string[] }
type GroupedSection = { sectionName: string, items: string[], groupMembers: string[] }
const sections = ref<(Section | GroupedSection)[]>([])

// Add function to update URL fragment
function updateUrlFragment(section: string, item: string, groupName?: string) {
    console.log('updateUrlFragment', section, item, groupName)
    if (!allowNextFragmentUpdate) {
        allowNextFragmentUpdate = true
        return
    }
    ignoreNextHashChange = true
    const params = new URLSearchParams()
    params.set('section', section)
    params.set('item', item)
    if (groupName) {
        params.set('group', groupName)
    }
    window.location.hash = params.toString()
}

function handleFileSelect(itemName: string, sectionName: string, groupName?: string) {
    console.log('handleFileSelect', itemName, sectionName, groupName)
    let path: string
    if (groupName) {
        path = `resource/${sectionName}/${groupName}/${itemName}.mid`
    } else {
        path = `resource/${sectionName}/${itemName}.mid`
    }
    (editors.value[sectionName] as InstanceType<typeof PianorollEditor>).loadMidiFile(path)
    selectedItems.value[sectionName] = itemName
}

function handleFileSwitcherClick(sectionName: string, itemName: string, groupName?: string) {
    updateUrlFragment(sectionName, itemName, groupName) // Add URL fragment update
}

async function handleGroupFileSelect(itemName: string, section: GroupedSection) {
    console.log('handleGroupFileSelect', itemName, section)
    const groupIndex = sections.value.indexOf(section)
    if (groupIndex === -1) return
    
    const editorGroup = editors.value[section.sectionName]
    if (!editorGroup) return

    selectedItems.value[section.sectionName] = itemName

    // for (const memberName of section.groupMembers) {
    //     const path = `resource/${section.sectionName}/${memberName}/${itemName}.mid`
    //     await editorGroup.loadMidiFile(memberName, path)
    // }

    // concurrently load the midi files
    await Promise.all(section.groupMembers.map(async (memberName) => {
        const path = `resource/${section.sectionName}/${memberName}/${itemName}.mid`
        await editorGroup.loadMidiFile(memberName, path)
    }))
}

let listJson: Record<string, { dirs: string[], files: string[] }> | null = null

async function ls(path: string) {
    return listJson![path]
}

function itemNameTrim(name: string) {
    // replaces some_text_0063000.mid with some_text_0063000
    console.log('itemNameTrim', name, name.replace(/\.mid$/, ''))
    return name.replace(/\.mid$/, '')
}

// Add settings type
interface SectionSettings {
    name: string
    description: string
    order: number
}

const settings = ref<{
    title: string
    description: string
    sections: SectionSettings[]
}>({title: "", description: "", sections: []})

const sectionInfoDict = ref<Record<string, SectionSettings>>({})

// Add markdown rendering function
function renderMarkdown(text: string): string {
    return marked(text, { breaks: true })
}

const store = useStore()


watch(() => store.bps, (newBps) => {
    for (const editor of Object.values(editors.value)) {
        editor.setBps(newBps)
    }
})


onMounted(async () => {
    listJson = await fetch('resource/list.json').then(res => res.json())
    // Load settings
    const settingsResponse = await fetch('resource/settings.json')
    if (settingsResponse.ok) {
        const payload = await settingsResponse.json()
        settings.value = payload
    }

    for (const section of settings.value.sections) {
        sectionInfoDict.value[section.name] = section
    }

    const sectionNames = (await ls('.')).dirs
    // sections.value = await Promise.all(res.dirs.map(async (dir: string) => ({ dir, items: (await ls(`midi/${dir}`)).files})))
    
    const sectionToOrderMap = new Map<string, number>()
    // default order is 0
    for (const sectionName of sectionNames) {
        sectionToOrderMap.set(sectionName, 0)
    }

    for (const section of settings.value.sections) {
        sectionToOrderMap.set(section.name, section.order)
    }

    const sortedSections = sectionNames.sort((a, b) => sectionToOrderMap.get(a)! - sectionToOrderMap.get(b)!)
    
    const urlParams = new URLSearchParams(window.location.hash.slice(1))
    const sectionNameFromUrl = urlParams.get('section')
    const itemNameFromUrl = urlParams.get('item')

    for (const sectionName of sortedSections) {
        const lsResult = await ls(`${sectionName}`)
        
        if (lsResult.dirs.length > 0) {
            const memberNames = lsResult.dirs
            const allItems = new Set<string>()
            for (const memberName of memberNames) {
                for (const item of (await ls(`${sectionName}/${memberName}`)).files) {
                    allItems.add(itemNameTrim(item))
                }
            }
            if (sectionNameFromUrl && itemNameFromUrl && sectionNameFromUrl == sectionName) {
                selectedItems.value[sectionName] = itemNameFromUrl
            } else {
                selectedItems.value[sectionName] = Array.from(allItems)[0]
            }
            sections.value.push({ sectionName, items: Array.from(allItems), groupMembers: memberNames })
        } else {
            if (sectionNameFromUrl && itemNameFromUrl && sectionNameFromUrl == sectionName) {
                selectedItems.value[sectionName] = itemNameFromUrl
            } else {
                selectedItems.value[sectionName] = itemNameTrim(lsResult.files[0])
            }
            sections.value.push({ sectionName, items: lsResult.files.map(itemNameTrim) })
        }
    }

    
    if (sectionNameFromUrl && itemNameFromUrl) {
        //scroll to the section
        nextTick(() => {
            if (store.bps) {
                for (const editor of Object.values(editors.value)) {
                    editor.setBps(store.bps)
                }
            }
            const sectionElement = document.getElementById(sectionNameFromUrl)
            if (sectionElement) {
                sectionElement.scrollIntoView({ behavior: 'smooth' })
            }
            // focus on the editor
            const editor = editors.value[sectionNameFromUrl]
            if (editor) {
                editor.focus()
            }
            allowNextFragmentUpdate = true
            window.addEventListener("hashchange", () => {
                if (ignoreNextHashChange) {
                    ignoreNextHashChange = false
                    return
                }
                allowNextFragmentUpdate = false
                console.log('hashchange', window.location.hash)
                const urlParams = new URLSearchParams(window.location.hash.slice(1))
                const sectionNameFromUrl = urlParams.get('section')
                const itemNameFromUrl = urlParams.get('item')
                if (!sectionNameFromUrl || !itemNameFromUrl) return
                // scroll to the section if not in view
                const sectionElement = document.getElementById(sectionNameFromUrl)
                if (sectionElement && !sectionElement.getBoundingClientRect().top) {
                    sectionElement.scrollIntoView({ behavior: 'smooth' })
                }
                // select the item in the tab switcher
                const tabSwitcher = tabSwitchers.value[sectionNameFromUrl]
                if (tabSwitcher) {
                    tabSwitcher.selectFile(itemNameFromUrl)
                }
            })
        })
    } else {
        allowNextFragmentUpdate = true
    }

});

function nextTick(fn: () => void) {
    setTimeout(fn, 0)
}

// Add focus handlers
function handleEditorFocus(section: Section | GroupedSection) {
    if (!section) return
    
    const editor = editors.value[section.sectionName]
    if (!editor) return
    const currentFile = selectedItems.value[section.sectionName]
    if (currentFile) {
        updateUrlFragment(section.sectionName, currentFile)
    }
}

watch(() => store.volume, (newVolume) => {
    player.setVolume(newVolume)
})

</script>

<style scoped>
:deep(a) {
    color: #58a6ff;
    text-decoration: none;
}

:deep(a:hover) {
    text-decoration: underline;
}

.app {
    flex-direction: column;
    padding-bottom: 20px;
}

.editor-container {
    flex: 1;
    min-height: 0;
    padding: 20px;
}

.editor {
    height: 300px;
}

h2 {
    padding: 20px 80px;
}

.section-content {
    padding: 0 60px;
}

.section-description {
    padding: 0px 140px 20px 140px;
    margin: -10px 0 20px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
}
.section{
    margin: 100px 0;
}
</style>