import { StyleSheet, Text, View } from 'react-native';

export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>보관함</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 20,
    color: '#11181C',
  },
});
