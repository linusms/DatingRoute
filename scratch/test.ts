import { addLivePlace } from '../src/lib/db';

async function main() {
  try {
    const res = await addLivePlace('test-room', 'test-user', {
      title: 'Test Place',
      category: 'Cafe',
      address: 'Seoul',
      roadAddress: 'Seoul Road',
      mapx: 127.0,
      mapy: 37.0,
      link: 'http://test',
      description: 'test',
      memo: 'test',
      order: 0,
    });
    console.log('Success:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
