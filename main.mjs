#!/usr/bin/env zx
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const makemkvcon = 'C:\\Program Files (x86)\\MakeMKV\\makemkvcon64'
const backups = 'F:\\backups\\Movies'
const todo = path.join(backups, 'ToDo')
const done = path.join(backups, 'Done')
const fromPath = movie => path.join(todo, movie)
const toPath = movie => path.join(done, movie)

// Models

class Info {
  constructor(stdout) {
    this.tracks = stdout
      .split('\n')
      .map(this.toTrack)
      .filter(track => {
        if (!track || track.size.unit !== 'GB') {
          return false
        }

        return true
      })
      .sort((a, b) => (b.size.value > a.size.value ? 1 : 0))
  }

  get largestTrack() {
    return this.tracks[0]
  }

  toTrack = line => {
    try {
      // console.log('line!')
      const [msg, code, _, value] = line.split(',')
      const [type, id] = msg.split(':')
      if (type === 'TINFO' && code === '10') {
        return new Track(id, value)
      }
    } catch (err) {
      // console.log('err', err)
    }

    return null
  }
}

class Track {
  static regex = /(?<value>\d+\.\d+)\W(?<unit>\w+)/

  constructor(id, rawSize) {
    this.id = id
    const match = Track.regex.exec(rawSize)
    this.size = {
      value: Number(match.groups.value),
      unit: match.groups.unit,
    }
  }
}

// Script

const readdir = promisify(fs.readdir)

// Read Backups and Done folders and filter all of the "Done" stuff out of backups
const [todoListing, doneListing] = await Promise.all([readdir(todo), readdir(done)])
const movies = todoListing.filter(m => !doneListing.includes(m))

for (let title of movies) {
  const { stdout } = await $`${makemkvcon} info file:${fromPath(title)} -r` // get track info from backup
  const info = new Info(stdout)
  await $`echo "ripping ${title} track ${info.largestTrack.id} (${info.largestTrack.size.value} ${info.largestTrack.size.unit})"`
  fs.mkdirSync(toPath(title)) // create a directory to dump the mkv file
  await $`${makemkvcon} mkv file:${fromPath(title)} ${info.largestTrack.id} ${toPath(title)} -r` // convert it
}
